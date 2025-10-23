import { NextRequest, NextResponse } from 'next/server'

/**
 * Internal endpoint to ensure scheduler is initialized
 * This is called automatically by the client on app load
 */
export async function GET(request: NextRequest) {
  try {
    // Import scheduler - this will trigger auto-initialization
    await import('@/lib/scheduler')
    
    return NextResponse.json({ 
      message: 'Scheduler initialization triggered',
      enabled: process.env.ENABLE_SCHEDULER === 'true' || process.env.NODE_ENV === 'production'
    })
  } catch (error: any) {
    console.error('[Scheduler Init] Error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize scheduler', message: error.message },
      { status: 500 }
    )
  }
}

