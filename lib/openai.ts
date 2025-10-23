import OpenAI from 'openai'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

// Determine which AI provider to use
const AI_PROVIDER = GROQ_API_KEY ? 'groq' : OPENAI_API_KEY ? 'openai' : null

if (!AI_PROVIDER) {
  console.warn('[AI] No API key configured (tried GROQ_API_KEY and OPENAI_API_KEY)')
}

// Initialize the appropriate client
const client = AI_PROVIDER === 'groq' 
  ? new OpenAI({
      apiKey: GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : AI_PROVIDER === 'openai'
  ? new OpenAI({
      apiKey: OPENAI_API_KEY,
    })
  : null

// Model selection based on provider
const MODEL = AI_PROVIDER === 'groq' 
  ? 'llama-3.3-70b-versatile'  // Groq: Fast, free, no credit card needed (upgraded from 3.1)
  : 'gpt-4o-mini'                // OpenAI: Free tier (requires payment method)

export interface ShowRecommendation {
  title: string
  year: number
  genres: string[]
  reason: string
  similarTo: string[]
  posterUrl?: string | null
  traktId?: number
}

export interface GenreRecommendations {
  genre: string
  recommendations: ShowRecommendation[]
}

export async function getAIRecommendations(
  userShows: Array<{
    title: string
    genres: string[]
    overview: string
  }>
): Promise<GenreRecommendations[]> {
  if (!client) {
    throw new Error('AI API key not configured. Please set GROQ_API_KEY (free, no credit card) or OPENAI_API_KEY')
  }

  console.log(`[${AI_PROVIDER?.toUpperCase()}] Generating recommendations for`, userShows.length, 'shows using', MODEL)

  // Group shows by primary genre
  const showsByGenre: Record<string, typeof userShows> = {}
  
  userShows.forEach(show => {
    show.genres.forEach(genre => {
      if (!showsByGenre[genre]) {
        showsByGenre[genre] = []
      }
      showsByGenre[genre].push(show)
    })
  })

  const prompt = `You are a TV show recommendation expert. Based on the user's tracked shows, suggest NEW shows they might enjoy.

User's tracked shows:
${userShows.map(show => `- ${show.title} (${show.genres.join(', ')}): ${show.overview || 'No description'}`).join('\n')}

Requirements:
1. Group recommendations by genre (only genres the user already watches)
2. For each genre, suggest 3-5 shows
3. DO NOT recommend shows the user is already tracking
4. Provide a brief reason why each show is recommended
5. Mention which of the user's shows it's similar to

CRITICAL: Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.

JSON structure:
[
  {
    "genre": "Drama",
    "recommendations": [
      {
        "title": "Show Name",
        "year": 2023,
        "genres": ["Drama", "Thriller"],
        "reason": "Why this show matches their taste",
        "similarTo": ["Show1", "Show2"]
      }
    ]
  }
]

IMPORTANT JSON RULES:
- Use only double quotes ("), never single quotes (')
- No trailing commas
- Ensure all strings are properly escaped
- No line breaks within string values
- Return pure JSON only, no code block markers

Focus on quality, critically acclaimed shows. Separate darker shows (horror, thriller) from lighter shows (comedy, family).`

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a TV show recommendation expert. You provide personalized, thoughtful recommendations based on viewing history. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error(`No response from ${AI_PROVIDER}`)
    }

    console.log(`[${AI_PROVIDER?.toUpperCase()}] Response received, parsing...`)
    
    // Clean the response - remove markdown code blocks if present
    let cleanedContent = content.trim()
    
    // Remove ```json and ``` markers if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '')
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    
    // Remove any trailing commas before closing brackets (common JSON error)
    cleanedContent = cleanedContent.replace(/,(\s*[}\]])/g, '$1')
    
    // Fix common quote issues in JSON
    cleanedContent = cleanedContent
      .replace(/[\u2018\u2019]/g, "'")  // Replace smart single quotes
      .replace(/[\u201C\u201D]/g, '"')  // Replace smart double quotes
      .replace(/'/g, "'")  // Normalize apostrophes
    
    cleanedContent = cleanedContent.trim()
    
    console.log(`[${AI_PROVIDER?.toUpperCase()}] Cleaned content (first 200 chars):`, cleanedContent.substring(0, 200))
    console.log(`[${AI_PROVIDER?.toUpperCase()}] Content length:`, cleanedContent.length)
    
    // Parse the JSON response with better error handling
    let recommendations: GenreRecommendations[]
    try {
      recommendations = JSON.parse(cleanedContent) as GenreRecommendations[]
    } catch (parseError: any) {
      console.error(`[${AI_PROVIDER?.toUpperCase()}] JSON Parse Error:`, parseError.message)
      console.error(`[${AI_PROVIDER?.toUpperCase()}] Error position:`, parseError.message.match(/position (\d+)/)?.[1])
      
      // Log the problematic area
      const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0', 10)
      if (errorPos > 0) {
        const start = Math.max(0, errorPos - 100)
        const end = Math.min(cleanedContent.length, errorPos + 100)
        console.error(`[${AI_PROVIDER?.toUpperCase()}] Context around error:`, cleanedContent.substring(start, end))
      }
      
      console.error(`[${AI_PROVIDER?.toUpperCase()}] Full content (first 1000 chars):`, cleanedContent.substring(0, 1000))
      
      // Try to extract JSON from the response if there's extra text
      const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        console.log(`[${AI_PROVIDER?.toUpperCase()}] Attempting to extract JSON array from response...`)
        try {
          // Clean the extracted JSON too
          let extractedJson = jsonMatch[0]
          extractedJson = extractedJson.replace(/,(\s*[}\]])/g, '$1')
          recommendations = JSON.parse(extractedJson) as GenreRecommendations[]
          console.log(`[${AI_PROVIDER?.toUpperCase()}] Successfully extracted and parsed JSON from response`)
        } catch (secondError: any) {
          console.error(`[${AI_PROVIDER?.toUpperCase()}] Second parse attempt failed:`, secondError.message)
          throw new Error(`Failed to parse AI response as JSON. The AI returned malformed JSON. Please try regenerating the recommendations.`)
        }
      } else {
        throw new Error(`Failed to parse AI response as JSON. The AI response does not contain a valid JSON array. Please try regenerating the recommendations.`)
      }
    }
    
    console.log(`[${AI_PROVIDER?.toUpperCase()}] Successfully generated`, recommendations.length, 'genre groups')
    
    return recommendations
  } catch (error: any) {
    console.error(`[${AI_PROVIDER?.toUpperCase()}] Error generating recommendations:`, error)
    throw new Error('Failed to generate recommendations: ' + error.message)
  }
}

