import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { plexAPI } from '@/lib/plex'

// Generate a PIN for Plex OAuth
export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    console.log('[Plex Auth] Generating PIN for user', user.id)
    
    const pin = await plexAPI.generatePin()
    const authUrl = plexAPI.getAuthUrl(pin.id, pin.code)
    
    return NextResponse.json({
      pinId: pin.id,
      code: pin.code,
      authUrl
    })
  } catch (error: any) {
    console.error('[Plex Auth] Error generating PIN:', error)
    return NextResponse.json(
      { error: 'Failed to generate Plex PIN', message: error.message },
      { status: 500 }
    )
  }
})

