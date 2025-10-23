import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma, Prisma } from '@/lib/db'
import { syncPlexToDatabase } from '@/lib/plexSync'
import { logger } from '@/lib/logger'
import { rateLimiters } from '@/lib/rate-limit'

// Trigger Plex sync
export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  const startTime = Date.now()

  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.sync(request)
    if (rateLimitResponse) return rateLimitResponse

    logger.info('Starting Plex sync', { userId: user.id })

    const result = await syncPlexToDatabase(user.id)

    // Create sync log
    await prisma.syncLog.create({
      data: {
        userId: user.id,
        provider: 'plex',
        status: result.errors.length > 0 ? 'partial' : 'success',
        showsSynced: result.showsSynced,
        episodesSynced: result.episodesSynced,
        errors: result.errors.length > 0 ? result.errors : Prisma.JsonNull,
        duration: result.duration
      }
    })

    logger.info('Plex sync complete', { userId: user.id, result })
    logger.performance('Plex sync', Date.now() - startTime, { userId: user.id })

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error: any) {
    logger.error('Plex sync error', error, { userId: user.id })

    // Create error log
    await prisma.syncLog.create({
      data: {
        userId: user.id,
        provider: 'plex',
        status: 'error',
        showsSynced: 0,
        episodesSynced: 0,
        errors: [error.message]
      }
    })

    return NextResponse.json(
      { error: 'Failed to sync Plex', message: error.message },
      { status: 500 }
    )
  }
})

// Get sync logs
export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const logs = await prisma.syncLog.findMany({
      where: {
        userId: user.id,
        provider: 'plex'
      },
      orderBy: {
        syncedAt: 'desc'
      },
      take: 10
    })

    return NextResponse.json({ logs })
  } catch (error: any) {
    logger.error('Error fetching Plex sync logs', error, { userId: user.id })
    return NextResponse.json(
      { error: 'Failed to fetch sync logs', message: error.message },
      { status: 500 }
    )
  }
})

