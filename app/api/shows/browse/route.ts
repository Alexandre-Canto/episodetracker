import { NextRequest, NextResponse } from 'next/server'
import { traktAPI } from '@/lib/trakt'
import { prisma } from '@/lib/db'
import { getTMDBPosterUrl } from '@/lib/tmdb'
import { logger } from '@/lib/logger'
import { rateLimiters } from '@/lib/rate-limit'
import { validatePagination } from '@/lib/validation'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.api(request)
    if (rateLimitResponse) return rateLimitResponse

    const { searchParams } = new URL(request.url)
    
    // Basic parameters with validation
    const query = searchParams.get('query')
    const { page, limit } = validatePagination(searchParams.get('page'), searchParams.get('limit'))
    const type = searchParams.get('type') || 'popular'
    
    // Filter parameters
    const name = searchParams.get('name')
    const network = searchParams.get('network')
    const genre = searchParams.get('genre')
    const dayOfWeek = searchParams.get('dayOfWeek')
    const status = searchParams.get('status')
    const runtime = searchParams.get('runtime')
    const showAge = searchParams.get('showAge')
    const top100 = searchParams.get('top100') === 'true'
    const upcomingPremiers = searchParams.get('upcomingPremiers') === 'true'
    const excludeAdded = searchParams.get('excludeAdded') === 'true'

    let shows = []

    // Get user's existing shows for excludeAdded filter (only if excludeAdded is requested)
    let userShowIds: number[] = []
    if (excludeAdded) {
      // Note: excludeAdded filter requires authentication
      // Since this is a public browse endpoint, we skip this filter when not authenticated
      // The frontend should handle authentication before using this filter
    }

    if (query) {
      // Search shows
      const searchResults = await traktAPI.searchShows(query, page, limit)
      shows = searchResults.map(result => result.show)
    } else {
      // Get popular or trending shows
      if (type === 'trending') {
        shows = await traktAPI.getTrendingShows(page, limit)
      } else {
        shows = await traktAPI.getPopularShows(page, limit)
      }
    }

    // Handle special filters that require different API calls
    if (top100) {
      // For top 100, we could use a different endpoint or limit to top 100
      // For now, we'll just limit the results
      shows = shows.slice(0, 100)
    }

    if (upcomingPremiers) {
      // This would require a more complex implementation
      // For now, we'll filter shows that have a first_aired date in the future
      const now = new Date()
      shows = shows.filter(show => {
        if (!show.first_aired) return false
        const airDate = new Date(show.first_aired)
        return airDate > now
      })
    }

    // Apply filters
    if (shows.length > 0) {
      shows = shows.filter(show => {
        // Name filter
        if (name && show.title.toLowerCase().indexOf(name.toLowerCase()) === -1) {
          return false
        }
        
        // Network filter
        if (network && show.network && show.network.toLowerCase().indexOf(network.toLowerCase()) === -1) {
          return false
        }
        
        // Genre filter
        if (genre && (!show.genres || show.genres.indexOf(genre) === -1)) {
          return false
        }
        
        // Status filter
        if (status && status !== 'any' && show.status !== status) {
          return false
        }
        
        // Runtime filter
        if (runtime && runtime !== 'any') {
          if (runtime === '0-59' && show.runtime >= 60) {
            return false
          }
          if (runtime === '60+' && show.runtime < 60) {
            return false
          }
        }
        
        // Show age filter
        if (showAge && showAge !== 'any' && show.first_aired) {
          const showYear = new Date(show.first_aired).getFullYear()
          const currentYear = new Date().getFullYear()
          const age = currentYear - showYear
          
          if (showAge === '<1' && age >= 1) {
            return false
          }
          if (showAge === '1+' && age < 1) {
            return false
          }
        }
        
        // Day of week filter (this would need to be implemented based on your data structure)
        // For now, we'll skip this as it requires additional data
        
        // Exclude added shows filter (requires authentication)
        if (excludeAdded && userShowIds.length > 0 && userShowIds.indexOf(show.ids.trakt) !== -1) {
          return false
        }
        
        return true
      })
    }

    // Fetch poster URLs from TMDB for shows with TMDB IDs
    // We'll do this in parallel for better performance
    const showsWithPosters = await Promise.all(
      shows.map(async (show) => {
        if (show.ids && show.ids.tmdb) {
          try {
            const posterUrl = await getTMDBPosterUrl(show.ids.tmdb)
            return {
              ...show,
              posterUrl: posterUrl || null
            }
          } catch (error) {
            console.error(`Failed to fetch poster for ${show.title}:`, error)
            return {
              ...show,
              posterUrl: null
            }
          }
        }
        return {
          ...show,
          posterUrl: null
        }
      })
    )

    logger.performance('Browse shows', Date.now() - startTime, { count: showsWithPosters.length })
    
    return NextResponse.json({ shows: showsWithPosters })
  } catch (error) {
    logger.error('Browse shows error', error)
    return NextResponse.json(
      { error: 'Failed to fetch shows' },
      { status: 500 }
    )
  }
}
