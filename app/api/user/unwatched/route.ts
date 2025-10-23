import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    // Get user's shows with unwatched episodes
    const userShows = await prisma.userShow.findMany({
      where: {
        userId: user.id,
        status: {
          in: ['ongoing', 'watchlater']
        }
      },
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
      }
    })

    // Calculate unwatched episodes for each show
    const showsWithUnwatched = userShows.map(userShow => {
      // Flatten all episodes from all seasons
      const allEpisodes = userShow.show.seasons.flatMap(season => season.episodes)
      
      const unwatchedEpisodes = allEpisodes.filter(episode => {
        const userEpisode = episode.userEpisodes[0]
        return !userEpisode || !userEpisode.watched
      })

      // Transform seasons to match frontend expectations
      const transformedSeasons = userShow.show.seasons.map(season => ({
        seasonNumber: season.seasonNumber,
        episodes: season.episodes.map(episode => ({
          id: episode.id,
          title: episode.title,
          airDate: episode.airDate,
          overview: episode.overview,
          episodeNumber: episode.episodeNumber,
          watched: episode.userEpisodes[0]?.watched || false,
          season: {
            seasonNumber: season.seasonNumber
          }
        }))
      }))

      return {
        id: userShow.show.id,
        title: userShow.show.title,
        poster: userShow.show.poster,
        seasons: transformedSeasons,
        unwatchedCount: unwatchedEpisodes.length,
        totalRuntime: unwatchedEpisodes.reduce((total, episode) => 
          total + (episode.runtime || 0), 0
        )
      }
    }).filter(show => show.unwatchedCount > 0)

    // Calculate total time estimate
    const totalRuntime = showsWithUnwatched.reduce((total, show) => 
      total + show.totalRuntime, 0
    )

    const totalUnwatched = showsWithUnwatched.reduce((total, show) => 
      total + show.unwatchedCount, 0
    )

    return NextResponse.json({
      shows: showsWithUnwatched,
      totalUnwatched,
      totalRuntime
    })
  } catch (error) {
    console.error('Get unwatched shows error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unwatched shows' },
      { status: 500 }
    )
  }
})
