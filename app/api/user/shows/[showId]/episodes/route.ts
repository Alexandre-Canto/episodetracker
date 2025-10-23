import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser, context?: { params: { showId: string } }) => {
  try {
    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season')

    const showId = context?.params?.showId

    if (!showId) {
      return NextResponse.json(
        { error: 'Show ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this show
    const userShow = await prisma.userShow.findFirst({
      where: {
        userId: user.id,
        showId
      }
    })

    if (!userShow) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      )
    }

    // Get episodes
    const whereClause: any = {
      season: {
        showId
      }
    }
    if (season) {
      whereClause.season.seasonNumber = parseInt(season)
    }

    const episodes = await prisma.episode.findMany({
      where: whereClause,
      include: {
        season: true,
        userEpisodes: {
          where: {
            userId: user.id
          }
        }
      },
      orderBy: [
        { season: { seasonNumber: 'asc' } },
        { episodeNumber: 'asc' }
      ]
    })

    // Get available seasons
    const seasons = await prisma.season.findMany({
      where: { showId },
      select: { seasonNumber: true },
      orderBy: { seasonNumber: 'asc' }
    })

    const episodesWithWatchedStatus = episodes.map(episode => ({
      ...episode,
      watched: episode.userEpisodes[0]?.watched || false,
      watchedAt: episode.userEpisodes[0]?.watchedAt
    }))

    return NextResponse.json({
      episodes: episodesWithWatchedStatus,
      seasons: seasons.map(s => s.seasonNumber)
    })
  } catch (error) {
    console.error('Get show episodes error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch episodes' },
      { status: 500 }
    )
  }
})
