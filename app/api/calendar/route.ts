import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const targetDate = month && year 
      ? new Date(parseInt(year), parseInt(month) - 1, 1)
      : new Date()

    const startDate = startOfMonth(targetDate)
    const endDate = endOfMonth(targetDate)

    // Get user's tracked shows
    const userShows = await prisma.userShow.findMany({
      where: {
        userId: user.id,
        status: {
          in: ['ongoing', 'watchlater']
        }
      },
      include: {
        show: true
      }
    })

    const showIds = userShows.map(us => us.showId)

    // Get episodes for the month
    const episodes = await prisma.episode.findMany({
      where: {
        season: {
          showId: {
            in: showIds
          }
        },
        airDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        season: {
          include: {
            show: true
          }
        },
        userEpisodes: {
          where: {
            userId: user.id
          }
        }
      },
      orderBy: {
        airDate: 'asc'
      }
    })

    // Group episodes by date
    const episodesByDate = episodes.reduce((acc, episode) => {
      const dateKey = format(episode.airDate!, 'yyyy-MM-dd')
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push({
        ...episode,
        watched: episode.userEpisodes[0]?.watched || false
      })
      return acc
    }, {} as Record<string, any[]>)

    return NextResponse.json({
      episodesByDate,
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear()
    })
  } catch (error) {
    console.error('Get calendar error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    )
  }
})
