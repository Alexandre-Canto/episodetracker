# Telegram Notifications Setup Guide

Get notified instantly via Telegram when important events occur, such as new user signups!

## Features

- 🎉 New user signup notifications
- ⚠️ Security event alerts (optional)
- ✅ Test notification endpoint
- 🔔 Non-blocking async notifications

## Setup Steps

### 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow the prompts:
   - Choose a name for your bot (e.g., "Episode Tracker Bot")
   - Choose a username (must end in 'bot', e.g., "episodetracker_bot")
4. **Save the bot token** - you'll need this for `TELEGRAM_BOT_TOKEN`

Example bot token: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### 2. Get Your Chat ID

#### Option A: Using userinfobot (Easiest)

1. Search for **@userinfobot** in Telegram
2. Start a conversation with it
3. It will send you your chat ID
4. **Save this ID** - you'll need this for `TELEGRAM_CHAT_ID`

#### Option B: Manual Method

1. Start a chat with your bot (search for it by username)
2. Send any message to your bot (e.g., "Hello")
3. Visit this URL in your browser (replace `<YOUR_BOT_TOKEN>`):
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
4. Look for `"chat":{"id":123456789` in the response
5. **Save that number** - that's your chat ID

Example chat ID: `123456789` or `-123456789` (for groups)

### 3. Add to Environment Variables

Add these to your `.env` file:

```bash
# Telegram Notifications
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### 4. Restart the Application

```bash
docker-compose -f docker-compose.prod.yml restart app
```

or for dev:

```bash
docker-compose -f docker-compose.dev.yml restart app
```

### 5. Test the Setup

You can test if everything works using the API endpoint:

```bash
curl -X POST http://localhost:4000/api/admin/telegram/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

You should receive a test message in your Telegram!

## Notification Examples

### New User Signup

When someone registers, you'll receive:

```
🎉 New User Signup

👤 Name: John Doe
📧 Email: john@example.com
🆔 User ID: cln123abc456
🕐 Time: Oct 23, 2025, 2:30 PM UTC

Episode Tracker Registration
```

### Security Alert (Optional)

For security events:

```
⚠️ Security Alert

🔒 Event: Multiple Failed Login Attempts
📝 Description: 5 failed login attempts detected
🌐 IP Address: 192.168.1.100
🆔 User ID: cln123abc456
🕐 Time: Oct 23, 2025, 2:35 PM UTC

Episode Tracker Security Monitor
```

## Troubleshooting

### Not Receiving Notifications?

1. **Check bot token and chat ID are correct**
   ```bash
   # Test the endpoint
   GET /api/admin/telegram/test
   ```

2. **Verify bot is not blocked**
   - Make sure you've started a chat with your bot
   - Send at least one message to the bot first

3. **Check server logs**
   ```bash
   docker-compose -f docker-compose.prod.yml logs app | grep Telegram
   ```

4. **Test the Telegram API directly**
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
     -d "chat_id=<YOUR_CHAT_ID>" \
     -d "text=Test message"
   ```

### Common Issues

**Error: "Forbidden: bot was blocked by the user"**
- Solution: Open Telegram, find your bot, and click "Start" or "Restart"

**Error: "Bad Request: chat not found"**
- Solution: Double-check your chat ID. It might be negative for groups.

**Error: "Unauthorized"**
- Solution: Verify your bot token is correct

**No error but no message**
- Check that TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in your `.env` file
- Make sure the environment variables are loaded (restart containers)

## Group Notifications (Optional)

To receive notifications in a Telegram group:

1. Create a Telegram group
2. Add your bot to the group
3. Make the bot an admin (optional, but recommended)
4. Get the group chat ID:
   - Send a message in the group
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Look for the group chat ID (usually negative, like `-123456789`)
5. Use the group chat ID in your `.env` file

## Privacy & Security

- ✅ Bot token and chat ID are stored securely in environment variables
- ✅ No sensitive data is sent via Telegram (passwords, tokens, etc.)
- ✅ Notifications are non-blocking and won't affect app performance
- ✅ Failed notifications are logged but don't cause errors

## Advanced: Custom Notifications

You can add custom notifications by importing the telegram utility:

```typescript
import { notifySecurityEvent } from '@/lib/telegram'

// Send a custom security alert
await notifySecurityEvent({
  type: 'Suspicious Activity',
  description: 'Multiple API requests from same IP',
  ip: '192.168.1.100',
  userId: 'user_id_here'
})
```

## API Endpoints

### Test Notification
```
POST /api/admin/telegram/test
Authorization: Bearer <token>
```

Returns:
```json
{
  "success": true,
  "message": "Test notification sent successfully! Check your Telegram."
}
```

### Check Configuration
```
GET /api/admin/telegram/test
Authorization: Bearer <token>
```

Returns:
```json
{
  "configured": true,
  "botToken": "***configured***",
  "chatId": "***configured***"
}
```

## Disable Notifications

To disable Telegram notifications:

1. Remove or comment out the environment variables:
   ```bash
   # TELEGRAM_BOT_TOKEN=...
   # TELEGRAM_CHAT_ID=...
   ```

2. Restart the application

Notifications will be silently skipped if not configured.

---

**Questions?** Check the logs or test the setup using the provided endpoints!

