import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAIRecommendations, ShowRecommendation, GenreRecommendations } from '@/lib/openai'
import { traktAPI } from '@/lib/trakt'
import { getTMDBPosterUrl } from '@/lib/tmdb'
import { logger } from '@/lib/logger'
import { rateLimiters } from '@/lib/rate-limit'

// Enrich recommendations with poster URLs and Trakt IDs
async function enrichRecommendations(recommendations: GenreRecommendations[]): Promise<GenreRecommendations[]> {
  console.log('[AI Recommendations] Enriching recommendations with posters and Trakt IDs...')
  
  const enrichedRecommendations = await Promise.all(
    recommendations.map(async (genreGroup) => {
      const enrichedShows = await Promise.all(
        genreGroup.recommendations.map(async (show) => {
          try {
            // Search for the show on Trakt
            const searchResults = await traktAPI.searchShows(show.title)
            
            if (searchResults && searchResults.length > 0) {
              // Find the best match (first result with matching year if possible)
              const bestMatch = searchResults.find((result: any) => 
                result.show?.year === show.year
              ) || searchResults[0]
              
              const traktShow = bestMatch.show
              if (traktShow) {
                let posterUrl = null
                
                // Get poster from TMDB if available
                if (traktShow.ids?.tmdb) {
                  try {
                    posterUrl = await getTMDBPosterUrl(traktShow.ids.tmdb)
                  } catch (error) {
                    console.error(`[AI Recommendations] Failed to fetch poster for ${show.title}:`, error)
                  }
                }
                
                return {
                  ...show,
                  traktId: traktShow.ids?.trakt,
                  posterUrl
                }
              }
            }
            
            // No match found, return original show
            console.log(`[AI Recommendations] No Trakt match found for ${show.title}`)
            return show
          } catch (error) {
            console.error(`[AI Recommendations] Error enriching ${show.title}:`, error)
            return show
          }
        })
      )
      
      return {
        ...genreGroup,
        recommendations: enrichedShows
      }
    })
  )
  
  console.log('[AI Recommendations] Enrichment complete')
  return enrichedRecommendations
}

export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  const startTime = Date.now()

  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.ai(request)
    if (rateLimitResponse) return rateLimitResponse

    const { searchParams } = new URL(request.url)
    const regenerate = searchParams.get('regenerate') === 'true'
    
    logger.info('AI recommendations request', { userId: user.id, regenerate })
    
    // Check for cached recommendations first (unless regenerate is requested)
    if (!regenerate) {
      const cached = await prisma.aIRecommendation.findUnique({
        where: { userId: user.id }
      })
      
      if (cached) {
        console.log('[AI Recommendations] Found cached recommendations from', cached.createdAt)
        // Cached recommendations should already be enriched, but return them as-is
        return NextResponse.json({
          recommendations: cached.recommendations,
          basedOn: cached.basedOn,
          generatedAt: cached.createdAt.toISOString(),
          cached: true
        })
      }
      
      console.log('[AI Recommendations] No cached recommendations found, generating new ones...')
    } else {
      console.log('[AI Recommendations] Regenerating recommendations (cache ignored)...')
    }
    
    // Get user's tracked shows
    const userShows = await prisma.userShow.findMany({
      where: {
        userId: user.id,
        status: {
          in: ['ongoing', 'watchlater', 'ended']
        }
      },
      include: {
        show: {
          select: {
            title: true,
            genres: true,
            overview: true,
          }
        }
      },
      take: 20 // Limit to prevent too large prompts
    })

    if (userShows.length === 0) {
      return NextResponse.json({
        error: 'No shows tracked',
        message: 'Add some shows to your library first to get recommendations'
      }, { status: 400 })
    }

    console.log('[AI Recommendations] Found', userShows.length, 'shows')

    // Transform to the format expected by OpenAI
    const shows = userShows.map((us: any) => ({
      title: us.show.title,
      genres: us.show.genres,
      overview: us.show.overview || ''
    }))

    // Get AI recommendations
    const recommendations = await getAIRecommendations(shows)

    // Enrich recommendations with posters and Trakt IDs
    const enrichedRecommendations = await enrichRecommendations(recommendations)

    // Save to cache (upsert: create or update)
    const now = new Date()
    await prisma.aIRecommendation.upsert({
      where: { userId: user.id },
      update: {
        recommendations: enrichedRecommendations as any, // Prisma Json type
        basedOn: userShows.length,
        updatedAt: now
      },
      create: {
        userId: user.id,
        recommendations: enrichedRecommendations as any,
        basedOn: userShows.length,
        createdAt: now
      }
    })

    console.log('[AI Recommendations] Cached new recommendations for user', user.id)

    return NextResponse.json({
      recommendations: enrichedRecommendations,
      basedOn: userShows.length,
      generatedAt: now.toISOString(),
      cached: false
    })
  } catch (error: any) {
    console.error('[AI Recommendations] Error:', error)
    
    if (error.message.includes('API key not configured')) {
      return NextResponse.json(
        { 
          error: 'AI service not configured',
          message: 'No AI API key configured. Please set GROQ_API_KEY (free, no credit card) or OPENAI_API_KEY in your environment.'
        },
        { status: 503 }
      )
    }
    
    // Check for OpenAI quota errors
    if (error.message.includes('429') || error.message.includes('quota')) {
      return NextResponse.json(
        { 
          error: 'AI quota exceeded',
          message: 'OpenAI requires a payment method to be added (even for free tier). Consider using Groq instead - truly free with no credit card required. Set GROQ_API_KEY in your .env file.'
        },
        { status: 429 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate recommendations',
        message: error.message 
      },
      { status: 500 }
    )
  }
})

