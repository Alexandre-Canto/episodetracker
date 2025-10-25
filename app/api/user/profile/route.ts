import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    // Get all watched episodes for the user (no limit)
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
        watchedAt: 'desc'
      }
    })

    // Get all shows the user is tracking (regardless of watch status)
    const trackedShows = await prisma.userShow.findMany({
      where: {
        userId: user.id
      },
      include: {
        show: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Get all user episodes (watched and unwatched) for statistics
    const allUserEpisodes = await prisma.userEpisode.findMany({
      where: {
        userId: user.id
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
      }
    })

    // Calculate statistics
    const totalEpisodesWatched = watchedEpisodes.length
    const totalShowsTracked = trackedShows.length
    const totalEpisodesTracked = allUserEpisodes.length
    const totalWatchedShows = new Set(watchedEpisodes.map(ue => ue.episode.season.show.id)).size
    
    // Calculate time spent watching (50 minutes per episode)
    const totalMinutesWatched = totalEpisodesWatched * 50
    const hoursWatched = Math.floor(totalMinutesWatched / 60)
    const minutesWatched = totalMinutesWatched % 60
    const daysWatched = Math.floor(hoursWatched / 24)
    const remainingHours = hoursWatched % 24
    const monthsWatched = Math.floor(daysWatched / 30)
    const remainingDays = daysWatched % 30

    // Transform the data
    const episodes = watchedEpisodes.map(ue => ({
      id: ue.episode.id,
      title: ue.episode.title,
      airDate: ue.episode.airDate,
      episodeNumber: ue.episode.episodeNumber,
      watchedAt: ue.watchedAt || ue.updatedAt,
      show: {
        id: ue.episode.season.show.id,
        title: ue.episode.season.show.title,
        poster: ue.episode.season.show.poster,
      },
      season: {
        seasonNumber: ue.episode.season.seasonNumber
      }
    }))

    // Transform tracked shows
    const shows = trackedShows.map(us => ({
      id: us.show.id,
      title: us.show.title,
      poster: us.show.poster,
      status: us.status,
      rating: us.rating,
      createdAt: us.createdAt,
      updatedAt: us.updatedAt
    }))

    return NextResponse.json({ 
      episodes,
      shows,
      statistics: {
        totalEpisodesWatched,
        totalShowsTracked,
        totalEpisodesTracked,
        totalWatchedShows,
        timeWatched: {
          totalMinutes: totalMinutesWatched,
          hours: hoursWatched,
          minutes: minutesWatched,
          days: daysWatched,
          months: monthsWatched,
          formatted: {
            months: monthsWatched,
            days: remainingDays,
            hours: remainingHours,
            minutes: minutesWatched
          }
        }
      }
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    )
  }
})

