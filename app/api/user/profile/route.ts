import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    // Get all watched episodes for the user (both manually tracked and Plex-synced)
    const watchedEpisodes = await prisma.userEpisode.findMany({
      where: {
        userId: user.id,
        watched: true,
      },
      include: {
        episode: {
          include: {
            season: {
              include: {
                show: true
              }
            }
          }
        }
      },
      orderBy: {
        watchedAt: 'desc' // Use watchedAt instead of updatedAt for better chronological order
      },
      take: 200 // Increased limit to show more Plex-synced episodes
    })

    // Transform the data
    const episodes = watchedEpisodes.map(ue => ({
      id: ue.episode.id,
      title: ue.episode.title,
      airDate: ue.episode.airDate,
      episodeNumber: ue.episode.episodeNumber,
      watchedAt: ue.watchedAt || ue.updatedAt, // Use watchedAt from Plex sync if available
      show: {
        id: ue.episode.season.show.id,
        title: ue.episode.season.show.title,
        poster: ue.episode.season.show.poster,
      },
      season: {
        seasonNumber: ue.episode.season.seasonNumber
      }
    }))

    return NextResponse.json({ episodes })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    )
  }
})

