/**
 * Telegram Bot Integration
 * Sends notifications for important events
 */

import { logger } from './logger'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

interface TelegramMessage {
  text: string
  parse_mode?: 'Markdown' | 'HTML'
  disable_notification?: boolean
}

/**
 * Send a message via Telegram Bot
 */
async function sendTelegramMessage(message: TelegramMessage): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    logger.warn('Telegram notifications disabled: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured')
    return false
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message.text,
        parse_mode: message.parse_mode || 'Markdown',
        disable_notification: message.disable_notification || false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Telegram API error', { status: response.status, error })
      return false
    }

    logger.info('Telegram notification sent successfully')
    return true
  } catch (error) {
    logger.error('Failed to send Telegram notification', error)
    return false
  }
}

/**
 * Notify about a new user signup
 */
export async function notifyNewUserSignup(user: {
  email: string
  name: string | null
  id: string
}): Promise<void> {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  const message = `
🎉 *New User Signup*

👤 *Name:* ${user.name || 'Not provided'}
📧 *Email:* ${user.email}
🆔 *User ID:* \`${user.id}\`
🕐 *Time:* ${timestamp} UTC

_Episode Tracker Registration_
`.trim()

  await sendTelegramMessage({
    text: message,
    parse_mode: 'Markdown',
    disable_notification: false,
  })
}

/**
 * Notify about important security events
 */
export async function notifySecurityEvent(event: {
  type: string
  description: string
  ip?: string
  userId?: string
}): Promise<void> {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  const message = `
⚠️ *Security Alert*

🔒 *Event:* ${event.type}
📝 *Description:* ${event.description}
${event.ip ? `🌐 *IP Address:* \`${event.ip}\`` : ''}
${event.userId ? `🆔 *User ID:* \`${event.userId}\`` : ''}
🕐 *Time:* ${timestamp} UTC

_Episode Tracker Security Monitor_
`.trim()

  await sendTelegramMessage({
    text: message,
    parse_mode: 'Markdown',
    disable_notification: false,
  })
}

/**
 * Send a test notification to verify Telegram setup
 */
export async function sendTestNotification(): Promise<boolean> {
  const message = `
✅ *Telegram Bot Test*

Your Episode Tracker Telegram notifications are working correctly!

🕐 *Time:* ${new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC
`.trim()

  return await sendTelegramMessage({
    text: message,
    parse_mode: 'Markdown',
  })
}

/**
 * Check if Telegram notifications are configured
 */
export function isTelegramConfigured(): boolean {
  return !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)
}

