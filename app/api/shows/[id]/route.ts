import { NextRequest, NextResponse } from 'next/server'
import { traktAPI } from '@/lib/trakt'
import { prisma } from '@/lib/db'
import { getTMDBPosterUrl } from '@/lib/tmdb'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const showId = context.params.id
    
    if (!showId) {
      return NextResponse.json(
        { error: 'Show ID is required' },
        { status: 400 }
      )
    }

    // Check if this is a Trakt ID (numeric) or a database ID
    const isTraktId = /^\d+$/.test(showId)
    
    let traktId: number | null = null
    let userShow = null
    let dbShow = null

    // Try to get user info if authenticated
    const user = await getAuthenticatedUser(request)
    const userId = user?.id || null

    if (isTraktId) {
      traktId = parseInt(showId)
    } else {
      // It's a database show ID, fetch the show
      dbShow = await prisma.show.findUnique({
        where: { id: showId },
        include: {
          seasons: {
            include: {
              episodes: {
                include: {
                  userEpisodes: {
                    where: userId ? { userId: userId } : undefined
                  }
                }
              }
            }
          }
        }
      })
      
      if (!dbShow) {
        return NextResponse.json(
          { error: 'Show not found' },
          { status: 404 }
        )
      }
      
      traktId = dbShow.traktId

      // Get user show info if authenticated
      if (userId) {
        userShow = await prisma.userShow.findFirst({
          where: {
            userId: userId,
            showId: showId
          },
          select: {
            id: true,
            status: true,
            rating: true
          }
        })
      }
    }

    // If we have database show data, use it instead of fetching from Trakt
    if (dbShow) {
      // Use database data
      const show = {
        id: showId,
        traktId: dbShow.traktId,
        title: dbShow.title,
        overview: dbShow.overview,
        poster: dbShow.poster,
        year: dbShow.firstAired ? new Date(dbShow.firstAired).getFullYear() : null,
        status: dbShow.status,
        network: dbShow.network,
        genres: dbShow.genres || [],
        runtime: dbShow.runtime,
        rating: 0, // Default rating
        votes: 0, // Default votes
        trailer: null,
        firstAired: dbShow.firstAired,
        country: null,
        language: 'en',
        airedEpisodes: dbShow.seasons.reduce((total, season) => total + season.episodes.length, 0),
        seasons: dbShow.seasons.map(season => ({
          seasonNumber: season.seasonNumber,
          episodeCount: season.episodes.length,
          episodes: season.episodes.map(episode => ({
            id: episode.id,
            title: episode.title,
            overview: episode.overview || '',
            episodeNumber: episode.episodeNumber,
            seasonNumber: season.seasonNumber,
            airDate: episode.airDate,
            runtime: episode.runtime || dbShow.runtime,
            watched: episode.userEpisodes.length > 0 ? episode.userEpisodes[0].watched : false
          }))
        })),
        cast: [], // No cast data from database
        userShow: userShow
      }

      return NextResponse.json({ show })
    }

    // Fallback to Trakt API for external shows
    if (!traktId) {
      return NextResponse.json(
        { error: 'Invalid show ID' },
        { status: 400 }
      )
    }

    // Fetch show details from Trakt
    const showDetails = await traktAPI.getShowDetails(traktId)
    
    // Fetch seasons and episodes
    const seasons = await traktAPI.getShowSeasons(traktId)
    
    // Fetch cast information
    let cast: any[] = []
    try {
      const castResponse = await fetch(`https://api.trakt.tv/shows/${traktId}/people`, {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-key': process.env.TRAKT_CLIENT_ID!,
          'trakt-api-version': '2',
        }
      })
      if (castResponse.ok) {
        const castData = await castResponse.json()
        cast = castData.cast || []
      }
    } catch (error) {
      console.error('Failed to fetch cast:', error)
    }

    // Fetch poster from TMDB
    let posterUrl = null
    if (showDetails.ids.tmdb) {
      posterUrl = await getTMDBPosterUrl(showDetails.ids.tmdb)
    }

    // Get watched episodes for this user if authenticated
    let watchedEpisodeIds: Set<string> = new Set()
    if (userId) {
      const dbShow = await prisma.show.findUnique({
        where: { traktId: traktId },
        include: {
          seasons: {
            include: {
              episodes: {
                include: {
                  userEpisodes: {
                    where: {
                      userId: userId,
                      watched: true
                    }
                  }
                }
              }
            }
          }
        }
      })

      if (dbShow) {
        dbShow.seasons.forEach(season => {
          season.episodes.forEach(episode => {
            if (episode.userEpisodes.length > 0) {
              watchedEpisodeIds.add(`${season.seasonNumber}-${episode.episodeNumber}`)
            }
          })
        })
      }
    }

    // Transform seasons data
    const transformedSeasons = seasons
      .filter((season: any) => season.number > 0) // Filter out specials
      .map((season: any) => ({
        seasonNumber: season.number,
        episodeCount: season.episode_count || 0,
        episodes: (season.episodes || []).map((episode: any) => ({
          id: episode.ids?.trakt?.toString() || `${season.number}-${episode.number}`,
          title: episode.title || `Episode ${episode.number}`,
          overview: episode.overview || '',
          episodeNumber: episode.number,
          seasonNumber: season.number,
          airDate: episode.first_aired,
          runtime: episode.runtime || showDetails.runtime,
          watched: watchedEpisodeIds.has(`${season.number}-${episode.number}`)
        }))
      }))

    const show = {
      id: showId,
      traktId: traktId,
      title: showDetails.title,
      overview: showDetails.overview,
      poster: posterUrl,
      year: showDetails.year,
      status: showDetails.status,
      network: showDetails.network,
      genres: showDetails.genres || [],
      runtime: showDetails.runtime,
      rating: showDetails.rating,
      votes: showDetails.votes,
      trailer: showDetails.trailer,
      firstAired: showDetails.first_aired,
      country: showDetails.country,
      language: showDetails.language,
      airedEpisodes: showDetails.aired_episodes,
      seasons: transformedSeasons,
      cast: cast.slice(0, 20), // Limit to 20 cast members
      userShow: userShow
    }

    return NextResponse.json({ show })
  } catch (error: any) {
    console.error('Show details error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch show details', details: error.message },
      { status: 500 }
    )
  }
}

