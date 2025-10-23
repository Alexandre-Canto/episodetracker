import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedUser } from '@/lib/auth'
import { sendTestNotification, isTelegramConfigured } from '@/lib/telegram'
import { logger } from '@/lib/logger'

/**
 * Test Telegram notification setup
 * Admin endpoint to verify Telegram bot configuration
 */
export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    logger.info('Testing Telegram notification', { userId: user.id })

    if (!isTelegramConfigured()) {
      return NextResponse.json(
        { 
          error: 'Telegram not configured',
          message: 'Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables'
        },
        { status: 400 }
      )
    }

    const success = await sendTestNotification()

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification sent successfully! Check your Telegram.'
      })
    } else {
      return NextResponse.json(
        { 
          error: 'Failed to send notification',
          message: 'Check the server logs for details'
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('Telegram test error', error, { userId: user.id })
    return NextResponse.json(
      { error: 'Failed to send test notification', message: error.message },
      { status: 500 }
    )
  }
})

/**
 * Get Telegram configuration status
 */
export const GET = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  return NextResponse.json({
    configured: isTelegramConfigured(),
    botToken: process.env.TELEGRAM_BOT_TOKEN ? '***configured***' : 'not set',
    chatId: process.env.TELEGRAM_CHAT_ID ? '***configured***' : 'not set'
  })
})

