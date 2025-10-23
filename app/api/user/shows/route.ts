import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { traktAPI } from '@/lib/trakt'

export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const userShows = await prisma.userShow.findMany({
      where: { userId: user.id },
      include: {
        show: {
          include: {
            seasons: {
              include: {
                episodes: {
                  include: {
                    userEpisodes: {
                      where: {
                        userId: user.id
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate unwatched counts and enrich show data
    const enrichedShows = userShows.map(userShow => {
      const allEpisodes = userShow.show.seasons.flatMap(season => season.episodes)
      const unwatchedEpisodes = allEpisodes.filter(episode => {
        const userEpisode = episode.userEpisodes[0]
        return !userEpisode || !userEpisode.watched
      })
      
      // Find last and next episodes
      const now = new Date()
      const airedEpisodes = allEpisodes
        .filter(ep => ep.airDate && new Date(ep.airDate) <= now)
        .sort((a, b) => new Date(b.airDate!).getTime() - new Date(a.airDate!).getTime())
      
      const upcomingEpisodes = allEpisodes
        .filter(ep => ep.airDate && new Date(ep.airDate) > now)
        .sort((a, b) => new Date(a.airDate!).getTime() - new Date(b.airDate!).getTime())
      
      return {
        ...userShow,
        show: {
          ...userShow.show,
          unwatchedCount: unwatchedEpisodes.length,
          lastEpisode: airedEpisodes[0] || null,
          nextEpisode: upcomingEpisodes[0] || null,
        }
      }
    })

    // Group by status
    const showsByStatus = {
      ongoing: enrichedShows.filter(us => us.status === 'ongoing'),
      watchlater: enrichedShows.filter(us => us.status === 'watchlater'),
      ended: enrichedShows.filter(us => us.status === 'ended'),
      archived: enrichedShows.filter(us => us.status === 'archived')
    }

    return NextResponse.json({ showsByStatus })
  } catch (error) {
    console.error('Get user shows error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user shows' },
      { status: 500 }
    )
  }
})

export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { traktId, status = 'ongoing' } = await request.json()

    if (!traktId) {
      return NextResponse.json(
        { error: 'Show ID is required' },
        { status: 400 }
      )
    }

    // Check if show already exists in database
    let show = await prisma.show.findUnique({
      where: { traktId }
    })

    if (!show) {
      // Fetch show details from Trakt API
      console.log(`[TRAKT] Fetching show details for traktId: ${traktId}`)
      const traktShow = await traktAPI.getShowDetails(traktId)
      console.log(`[TRAKT] Show details fetched:`, traktShow.title, traktShow.status)
      
      // Fetch poster from TMDB if available
      let posterUrl = null
      console.log(`[SHOW] Processing show: ${traktShow.title}`)
      console.log(`[SHOW] Trakt IDs:`, JSON.stringify(traktShow.ids))
      
      if (traktShow.ids.tmdb) {
        console.log(`[SHOW] ✅ TMDB ID found: ${traktShow.ids.tmdb}`)
        const { getTMDBPosterUrl } = await import('@/lib/tmdb')
        posterUrl = await getTMDBPosterUrl(traktShow.ids.tmdb)
        console.log(`[SHOW] Final poster URL for ${traktShow.title}:`, posterUrl)
      } else {
        console.log(`[SHOW] ⚠️ No TMDB ID available for ${traktShow.title}`)
      }
      
      // Create show in database
      show = await prisma.show.create({
        data: {
          traktId: traktShow.ids.trakt,
          title: traktShow.title,
          overview: traktShow.overview,
          poster: posterUrl,
          status: traktShow.status,
          genres: traktShow.genres,
          network: traktShow.network,
          runtime: traktShow.runtime,
          firstAired: traktShow.first_aired ? new Date(traktShow.first_aired) : null
        }
      })

      // Fetch and store seasons and episodes
      try {
        console.log(`[TRAKT] Fetching seasons for traktId: ${traktId}`)
        const seasons = await traktAPI.getShowSeasons(traktId)
        console.log(`[TRAKT] Fetched ${seasons.length} seasons`)
        
        for (const season of seasons) {
          // Skip special seasons (season 0)
          if (season.number === 0) {
            console.log(`[TRAKT] Skipping season 0 (specials)`)
            continue
          }
          
          console.log(`[TRAKT] Processing season ${season.number}, episode_count: ${season.episode_count}`)
          
          // Create season
          const seasonRecord = await prisma.season.create({
            data: {
              showId: show.id,
              seasonNumber: season.number,
              title: season.title,
              overview: season.overview,
              airDate: season.first_aired ? new Date(season.first_aired) : null,
              episodeCount: season.episode_count || 0,
              traktId: season.ids?.trakt
            }
          })

          // Fetch episodes for this specific season
          try {
            console.log(`[TRAKT] Fetching episodes for season ${season.number}`)
            const episodes = await traktAPI.getShowEpisodes(traktId, season.number)
            console.log(`[TRAKT] Fetched ${episodes.length} episodes for season ${season.number}`)
            
            for (const episode of episodes) {
              console.log(`[TRAKT] Creating episode S${season.number}E${episode.number}: ${episode.title}`)
              await prisma.episode.create({
                data: {
                  seasonId: seasonRecord.id,
                  episodeNumber: episode.number,
                  title: episode.title || `Episode ${episode.number}`,
                  airDate: episode.first_aired ? new Date(episode.first_aired) : null,
                  traktId: episode.ids?.trakt,
                  overview: episode.overview,
                  runtime: episode.runtime
                }
              })
            }
            console.log(`[TRAKT] Successfully created ${episodes.length} episodes for season ${season.number}`)
          } catch (episodeErr) {
            console.error(`[TRAKT ERROR] Failed to fetch episodes for season ${season.number}:`, episodeErr)
          }
        }
      } catch (episodeError) {
        console.error('Error fetching seasons:', episodeError)
        // Continue even if episodes fail to load
      }
    }

    // Check if user already has this show
    const existingUserShow = await prisma.userShow.findUnique({
      where: {
        userId_showId: {
          userId: user.id,
          showId: show.id
        }
      }
    })

    if (existingUserShow) {
      return NextResponse.json(
        { error: 'Show already in your list' },
        { status: 400 }
      )
    }

    // Add show to user's list
    const userShow = await prisma.userShow.create({
      data: {
        userId: user.id,
        showId: show.id,
        status
      },
      include: {
        show: true
      }
    })

    return NextResponse.json({ userShow })
  } catch (error) {
    console.error('Add show error:', error)
    return NextResponse.json(
      { error: 'Failed to add show' },
      { status: 500 }
    )
  }
})
