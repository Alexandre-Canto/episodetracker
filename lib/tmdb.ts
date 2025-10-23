import axios from 'axios'
import { cacheGet, cacheSet } from '@/lib/redis'

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

// Cache TTL: 30 days (poster URLs rarely change)
const CACHE_TTL = 30 * 24 * 60 * 60

// Detect if we're using v3 API key or v4 bearer token
const isV4Token = TMDB_API_KEY && TMDB_API_KEY.startsWith('eyJ')

console.log('[TMDB] Configuration loaded:')
console.log('[TMDB] - API Key present:', !!TMDB_API_KEY)
console.log('[TMDB] - API Key length:', TMDB_API_KEY?.length || 0)
console.log('[TMDB] - Auth type:', isV4Token ? 'v4 Bearer Token' : 'v3 API Key')
console.log('[TMDB] - Base URL:', TMDB_BASE_URL)
console.log('[TMDB] - Image Base URL:', TMDB_IMAGE_BASE_URL)
console.log('[TMDB] - Cache TTL:', CACHE_TTL, 'seconds (30 days)')

export async function getTMDBPosterUrl(tmdbId: number): Promise<string | null> {
  console.log(`[TMDB] getTMDBPosterUrl called with tmdbId: ${tmdbId}`)
  
  // Create cache key
  const cacheKey = `tmdb:poster:${tmdbId}`
  
  // Try to get from cache first
  try {
    const cachedUrl = await cacheGet(cacheKey)
    if (cachedUrl) {
      if (cachedUrl === 'null') {
        console.log(`[TMDB] ✅ Cache HIT - cached null result for TMDB ID ${tmdbId}`)
        return null
      }
      console.log(`[TMDB] ✅ Cache HIT - returning cached poster URL for TMDB ID ${tmdbId}`)
      return cachedUrl
    }
  } catch (error: any) {
    console.warn(`[TMDB] ⚠️ Cache read failed, continuing without cache:`, error.message)
  }
  
  if (!TMDB_API_KEY) {
    console.warn('[TMDB] ❌ TMDB_API_KEY not configured!')
    console.warn('[TMDB] Please set TMDB_API_KEY environment variable')
    return null
  }

  try {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}`
    console.log(`[TMDB] Fetching from URL: ${url}`)
    
    // Configure headers based on auth type
    const headers: any = {}
    if (isV4Token) {
      headers['Authorization'] = `Bearer ${TMDB_API_KEY}`
    }
    
    const response = await axios.get(url, {
      headers,
      params: isV4Token ? {} : {
        api_key: TMDB_API_KEY
      }
    })

    console.log(`[TMDB] ✅ Response received for TMDB ID ${tmdbId}`)
    console.log(`[TMDB] Show title: ${response.data.name}`)
    console.log(`[TMDB] Poster path: ${response.data.poster_path}`)

    if (response.data.poster_path) {
      const posterUrl = `${TMDB_IMAGE_BASE_URL}${response.data.poster_path}`
      console.log(`[TMDB] ✅ Poster URL constructed: ${posterUrl}`)
      
      // Cache the result
      try {
        await cacheSet(cacheKey, posterUrl, CACHE_TTL)
        console.log(`[TMDB] ✅ Poster URL cached for ${CACHE_TTL}s (30 days)`)
      } catch (error: any) {
        console.warn(`[TMDB] ⚠️ Failed to cache poster URL:`, error.message)
      }
      
      return posterUrl
    }

    console.warn(`[TMDB] ⚠️ No poster_path in response for TMDB ID ${tmdbId}`)
    
    // Cache the null result for a shorter time to avoid repeated API calls
    try {
      await cacheSet(cacheKey, 'null', 60 * 60) // 1 hour
      console.log(`[TMDB] ⚠️ Cached null result for 1 hour`)
    } catch (error: any) {
      console.warn(`[TMDB] ⚠️ Failed to cache null result:`, error.message)
    }
    
    return null
  } catch (error: any) {
    console.error(`[TMDB] ❌ Failed to fetch TMDB poster for ID ${tmdbId}`)
    if (error.response) {
      console.error(`[TMDB] - Status: ${error.response.status}`)
      console.error(`[TMDB] - Message: ${error.response.data?.status_message || 'No message'}`)
      
      // If it's a 404, cache the null result
      if (error.response.status === 404) {
        try {
          await cacheSet(cacheKey, 'null', 60 * 60) // 1 hour
          console.log(`[TMDB] ⚠️ Cached 404 result for 1 hour`)
        } catch (cacheError: any) {
          console.warn(`[TMDB] ⚠️ Failed to cache 404 result:`, cacheError.message)
        }
      }
    } else if (error.request) {
      console.error('[TMDB] - No response received from TMDB API')
    } else {
      console.error(`[TMDB] - Error: ${error.message}`)
    }
    return null
  }
}

export function constructTMDBPosterUrl(posterPath: string): string {
  return `${TMDB_IMAGE_BASE_URL}${posterPath}`
}

// Helper function to get cache statistics
export async function getCacheStats(): Promise<{ hits: number; misses: number } | null> {
  try {
    const { getRedisClient } = await import('@/lib/redis')
    const client = getRedisClient()
    if (!client) return null
    
    const keys = await client.keys('tmdb:poster:*')
    return {
      hits: keys.length,
      misses: 0 // We don't track misses separately
    }
  } catch (error) {
    return null
  }
}
