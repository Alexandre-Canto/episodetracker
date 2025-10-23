import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { plexAPI, encryptToken } from '@/lib/plex'

// Connect Plex integration
export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { authToken, serverUrl, serverName, username, email } = await request.json()
    
    if (!authToken || !serverUrl) {
      return NextResponse.json(
        { error: 'Auth token and server URL are required' },
        { status: 400 }
      )
    }
    
    console.log('[Plex Connect] Connecting Plex for user', user.id)
    
    // Test the connection
    try {
      await plexAPI.getTVLibraries(serverUrl, authToken)
    } catch (error) {
      console.error('[Plex Connect] Failed to connect to server:', error)
      return NextResponse.json(
        { error: 'Failed to connect to Plex server. Please check your server URL and try again.' },
        { status: 400 }
      )
    }
    
    // Encrypt the token
    const encryptedToken = encryptToken(authToken)
    
    // Save or update integration
    const integration = await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'plex'
        }
      },
      update: {
        serverUrl,
        accessToken: encryptedToken,
        plexUsername: username,
        plexEmail: email,
        serverName,
        enabled: true,
        autoSync: true, // Enable daily auto-sync by default
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        provider: 'plex',
        serverUrl,
        accessToken: encryptedToken,
        plexUsername: username,
        plexEmail: email,
        serverName,
        enabled: true,
        autoSync: true // Enable daily auto-sync by default
      }
    })
    
    console.log('[Plex Connect] Integration saved:', integration.id)
    
    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        provider: integration.provider,
        serverName: integration.serverName,
        plexUsername: integration.plexUsername,
        enabled: integration.enabled,
        createdAt: integration.createdAt
      }
    })
  } catch (error: any) {
    console.error('[Plex Connect] Error:', error)
    return NextResponse.json(
      { error: 'Failed to connect Plex', message: error.message },
      { status: 500 }
    )
  }
})

// Get Plex integration status
export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const integration = await prisma.integration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'plex'
        }
      },
      select: {
        id: true,
        provider: true,
        serverUrl: true,
        serverName: true,
        plexUsername: true,
        plexEmail: true,
        lastSync: true,
        enabled: true,
        autoSync: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    if (!integration) {
      return NextResponse.json({
        connected: false
      })
    }
    
    return NextResponse.json({
      connected: true,
      integration
    })
  } catch (error: any) {
    console.error('[Plex Connect] Error fetching status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch integration status', message: error.message },
      { status: 500 }
    )
  }
})

// Disconnect Plex
export const DELETE = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    await prisma.integration.delete({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'plex'
        }
      }
    })
    
    console.log('[Plex Connect] Integration disconnected for user', user.id)
    
    return NextResponse.json({
      success: true,
      message: 'Plex integration disconnected'
    })
  } catch (error: any) {
    console.error('[Plex Connect] Error disconnecting:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Plex', message: error.message },
      { status: 500 }
    )
  }
})

