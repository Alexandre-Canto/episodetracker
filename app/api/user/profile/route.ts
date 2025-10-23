import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    // Get all watched episodes for the user
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
        updatedAt: 'desc'
      },
      take: 100 // Limit to last 100 watched episodes
    })

    // Transform the data
    const episodes = watchedEpisodes.map(ue => ({
      id: ue.episode.id,
      title: ue.episode.title,
      airDate: ue.episode.airDate,
      episodeNumber: ue.episode.episodeNumber,
      watchedAt: ue.updatedAt,
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

