import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Update Plex integration settings
export const PATCH = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { autoSync } = await request.json()
    
    if (autoSync === undefined) {
      return NextResponse.json(
        { error: 'autoSync field is required' },
        { status: 400 }
      )
    }
    
    console.log('[Plex Settings] Updating autoSync to', autoSync, 'for user', user.id)
    
    const integration = await prisma.integration.update({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'plex'
        }
      },
      data: {
        autoSync: Boolean(autoSync)
      }
    })
    
    console.log('[Plex Settings] Settings updated:', integration.id)
    
    return NextResponse.json({
      success: true,
      autoSync: integration.autoSync
    })
  } catch (error: any) {
    console.error('[Plex Settings] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings', message: error.message },
      { status: 500 }
    )
  }
})

