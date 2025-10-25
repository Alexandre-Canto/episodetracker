import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { traktAPI } from '@/lib/trakt'

export const PATCH = requireAuth(async (request: NextRequest, user: AuthenticatedUser, context?: { params: { id: string } }) => {
  try {
    const { watched, showId, seasonNumber, episodeNumber } = await request.json()
    const episodeId = context?.params?.id

    if (!episodeId) {
      return NextResponse.json(
        { error: 'Episode ID is required' },
        { status: 400 }
      )
    }

    if (typeof watched !== 'boolean') {
      return NextResponse.json(
        { error: 'Watched status must be boolean' },
        { status: 400 }
      )
    }

    // Check if this is a database episode ID or a Trakt/generated ID
    let dbEpisode = await prisma.episode.findFirst({
      where: {
        OR: [
          { id: episodeId },
          { traktId: parseInt(episodeId) }
        ]
      },
      include: {
        season: {
          include: {
            show: {
              include: {
                userShows: {
                  where: {
                    userId: user.id
                  }
                }
              }
            }
          }
        }
      }
    })

    // If episode not found in database, we need to create it
    if (!dbEpisode) {
      if (!showId || !seasonNumber || !episodeNumber) {
        return NextResponse.json(
          { error: 'Show ID, season number, and episode number are required for new episodes' },
          { status: 400 }
        )
      }

      // Check if user has this show in their library
      const userShow = await prisma.userShow.findFirst({
        where: {
          userId: user.id,
          showId: showId
        }
      })

      if (!userShow) {
        return NextResponse.json(
          { error: 'Show not in your library' },
          { status: 400 }
        )
      }

      // Get the show to find its Trakt ID
      const show = await prisma.show.findUnique({
        where: { id: showId }
      })

      if (!show) {
        return NextResponse.json(
          { error: 'Show not found' },
          { status: 404 }
        )
      }

      // Find or create season
      let season = await prisma.season.findFirst({
        where: {
          showId: showId,
          seasonNumber: seasonNumber
        }
      })

      if (!season) {
        // Create season and all its episodes
        const traktSeason = await traktAPI.getSeasonEpisodes(show.traktId, seasonNumber)
        
        season = await prisma.season.create({
          data: {
            showId: showId,
            seasonNumber: seasonNumber,
            episodeCount: traktSeason.length
          }
        })

        // Create all episodes for this season
        for (const traktEpisode of traktSeason) {
          try {
            await prisma.episode.create({
              data: {
                seasonId: season.id,
                episodeNumber: traktEpisode.number,
                title: traktEpisode.title || `Episode ${traktEpisode.number}`,
                overview: traktEpisode.overview,
                airDate: traktEpisode.first_aired ? new Date(traktEpisode.first_aired) : null,
                runtime: traktEpisode.runtime
              }
            })
          } catch (error) {
            console.error(`Error creating episode S${seasonNumber}E${traktEpisode.number}:`, error)
          }
        }
      }

      // Find the specific episode
      dbEpisode = await prisma.episode.findFirst({
        where: {
          seasonId: season.id,
          episodeNumber: episodeNumber
        },
        include: {
          season: {
            include: {
              show: {
                include: {
                  userShows: {
                    where: {
                      userId: user.id
                    }
                  }
                }
              }
            }
          }
        }
      })

      if (!dbEpisode) {
        return NextResponse.json(
          { error: 'Episode not found' },
          { status: 404 }
        )
      }
    } else {
      // Verify user has access to this episode
      if (dbEpisode.season.show.userShows.length === 0) {
        return NextResponse.json(
          { error: 'Episode not found' },
          { status: 404 }
        )
      }
    }

    // Update or create user episode record
    const userEpisode = await prisma.userEpisode.upsert({
      where: {
        userId_episodeId: {
          userId: user.id,
          episodeId: dbEpisode.id
        }
      },
      update: {
        watched,
        watchedAt: watched ? new Date() : null
      },
      create: {
        userId: user.id,
        episodeId: dbEpisode.id,
        watched,
        watchedAt: watched ? new Date() : null
      }
    })

    return NextResponse.json({ 
      success: true,
      watched: userEpisode.watched,
      watchedAt: userEpisode.watchedAt
    })
  } catch (error) {
    console.error('Update episode watched status error:', error)
    return NextResponse.json(
      { error: 'Failed to update episode status' },
      { status: 500 }
    )
  }
})
