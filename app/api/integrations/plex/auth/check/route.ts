import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { plexAPI } from '@/lib/plex'

// Check if PIN has been authorized
export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { pinId } = await request.json()
    
    if (!pinId) {
      return NextResponse.json(
        { error: 'PIN ID is required' },
        { status: 400 }
      )
    }
    
    console.log('[Plex Auth] Checking PIN', pinId)
    
    const pin = await plexAPI.checkPin(pinId)
    
    if (!pin.authToken) {
      return NextResponse.json({
        authorized: false,
        message: 'Waiting for authorization'
      })
    }
    
    // Get user info
    const plexUser = await plexAPI.getUserInfo(pin.authToken)
    
    // Get available servers
    const servers = await plexAPI.getServers(pin.authToken)
    
    console.log('[Plex Auth] Authorization successful for', plexUser.username)
    
    return NextResponse.json({
      authorized: true,
      authToken: pin.authToken,
      user: {
        username: plexUser.username,
        email: plexUser.email
      },
      servers: servers.map(s => ({
        name: s.name,
        machineIdentifier: s.machineIdentifier,
        connections: s.connections
      }))
    })
  } catch (error: any) {
    console.error('[Plex Auth] Error checking PIN:', error)
    return NextResponse.json(
      { error: 'Failed to check PIN authorization', message: error.message },
      { status: 500 }
    )
  }
})

