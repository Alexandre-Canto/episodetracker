import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const PATCH = requireAuth(async (request: NextRequest, user: AuthenticatedUser, context?: { params: { id: string } }) => {
  try {
    const { watched } = await request.json()
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

    // Verify user has access to this episode
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
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

    if (!episode || episode.season.show.userShows.length === 0) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      )
    }

    // Update or create user episode record
    const userEpisode = await prisma.userEpisode.upsert({
      where: {
        userId_episodeId: {
          userId: user.id,
          episodeId
        }
      },
      update: {
        watched,
        watchedAt: watched ? new Date() : null
      },
      create: {
        userId: user.id,
        episodeId,
        watched,
        watchedAt: watched ? new Date() : null
      }
    })

    return NextResponse.json({ userEpisode })
  } catch (error) {
    console.error('Update episode watched status error:', error)
    return NextResponse.json(
      { error: 'Failed to update episode status' },
      { status: 500 }
    )
  }
})
