import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const PATCH = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { showId, seasonNumber } = await request.json()

    console.log('Mark season as watched request:', { showId, seasonNumber })

    if (!showId || seasonNumber === undefined || seasonNumber === null) {
      return NextResponse.json(
        { error: 'Show ID and season number are required' },
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

    // Get all episodes for the season
    const episodes = await prisma.episode.findMany({
      where: {
        season: {
          showId,
          seasonNumber: parseInt(seasonNumber)
        }
      }
    })

    // Mark all episodes as watched
    const userEpisodes = await Promise.all(
      episodes.map(episode =>
        prisma.userEpisode.upsert({
          where: {
            userId_episodeId: {
              userId: user.id,
              episodeId: episode.id
            }
          },
          update: {
            watched: true,
            watchedAt: new Date()
          },
          create: {
            userId: user.id,
            episodeId: episode.id,
            watched: true,
            watchedAt: new Date()
          }
        })
      )
    )

    return NextResponse.json({ 
      success: true, 
      markedCount: userEpisodes.length 
    })
  } catch (error) {
    console.error('Mark season as watched error:', error)
    return NextResponse.json(
      { error: 'Failed to mark season as watched' },
      { status: 500 }
    )
  }
})
