# Plex Integration Guide

Automatically sync your watched episodes from Plex Media Server to Episode Tracker!

## 🎯 Features

- ✅ OAuth authentication (like Overseerr)
- ✅ Secure token encryption
- ✅ Automatic show matching via TMDB/TVDB IDs
- ✅ Watch history sync with timestamps
- ✅ Manual and automatic sync options
- ✅ Detailed sync logs
- ✅ Multi-library support

## 🔧 Setup

### 1. Generate Encryption Key

First, generate a 32-character encryption key for storing Plex tokens securely:

```bash
# Option 1: Using OpenSSL
openssl rand -hex 16

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 2. Add to `.env` File

Add the following to your `.env` file:

```env
# Plex Integration
PLEX_CLIENT_ID=episodetracker
PLEX_PRODUCT=Episode Tracker
INTEGRATION_ENCRYPTION_KEY=your-32-character-key-here
```

### 3. Restart Docker Container

```bash
docker-compose -f docker-compose.dev.yml restart app
```

## 🚀 Usage

### Connect Plex

1. Navigate to **Integrations** in the sidebar
2. Click **"Connect Plex"**
3. A popup window will open
4. Sign in to your Plex account
5. Authorize "Episode Tracker"
6. The window will close automatically
7. Your Plex server is now connected!

### Sync Watch History

1. On the Integrations page, click **"Sync Now"**
2. The sync process will:
   - Scan all TV libraries on your Plex server
   - Find all watched episodes
   - Match shows to Trakt (via TMDB/TVDB IDs)
   - Add shows to your library (if not already added)
   - Mark episodes as watched
   - Preserve watch dates from Plex

### View Sync History

Recent syncs are displayed on the Integrations page, showing:
- Number of shows synced
- Number of episodes synced
- Sync duration
- Status (success/error/partial)
- Timestamp

## 🔄 How It Works

### Authentication Flow

```
1. Generate PIN → Plex API
2. User opens Plex.tv → Authorizes app
3. Poll for authorization → Get auth token
4. Fetch user servers → Select server
5. Test connection → Save encrypted token
```

### Sync Flow

```
1. Fetch TV libraries from Plex
2. Get all watched episodes
3. Group by show
4. For each show:
   ├── Extract TMDB/TVDB ID from Plex metadata
   ├── Match to Trakt (TMDB → TVDB → Search)
   ├── Create show in database (if needed)
   ├── Add to user's library
   └── For each watched episode:
       ├── Find or create season
       ├── Find or create episode (from Trakt)
       └── Mark as watched with timestamp
```

### Show Matching Priority

1. **TMDB ID** (most reliable)
2. **TVDB ID** (fallback)
3. **Title search** (last resort)

## 📊 Database Schema

### Integration Model

```prisma
model Integration {
  id             String   @id
  userId         String
  provider       String   // "plex"
  serverUrl      String
  accessToken    String   // Encrypted
  plexUsername   String?
  plexEmail      String?
  serverName     String?
  lastSync       DateTime?
  enabled        Boolean
  autoSync       Boolean
  createdAt      DateTime
  updatedAt      DateTime
}
```

### SyncLog Model

```prisma
model SyncLog {
  id             String   @id
  userId         String
  provider       String
  status         String   // "success", "error", "partial"
  showsSynced    Int
  episodesSynced Int
  errors         Json?
  duration       Int?
  syncedAt       DateTime
}
```

## 🔐 Security

- **Token Encryption**: Plex access tokens are encrypted using AES-256-CBC
- **Secure Storage**: Encrypted tokens stored in PostgreSQL
- **No Plain Text**: Tokens never stored or logged in plain text
- **User Isolation**: Each user's integration is completely isolated

## 🐛 Troubleshooting

### "Failed to connect to Plex server"

- **Check server URL**: Make sure your Plex server is accessible
- **Firewall**: Ensure port 32400 (or your custom port) is open
- **Remote Access**: If syncing remotely, enable Remote Access in Plex

### "Could not find show on Trakt"

- **Metadata**: Check if Plex has correct TMDB/TVDB IDs for the show
- **Fix in Plex**: Edit show metadata in Plex, refresh, and resync
- **Manual Add**: Add the show manually first, then resync

### "Sync taking too long"

- **Large Library**: First sync of large libraries can take 10-30+ minutes
- **Background**: Sync runs in background, you can navigate away
- **Subsequent Syncs**: Much faster as shows are already in database

### Sync Errors

Check sync logs on the Integrations page for detailed error messages:
- **Show Matching Errors**: Show couldn't be matched to Trakt
- **Episode Fetch Errors**: Episode details couldn't be fetched
- **Database Errors**: Database constraint violations (rare)

## 📝 API Endpoints

### Authentication

```
GET  /api/integrations/plex/auth/pin        # Generate PIN
POST /api/integrations/plex/auth/check      # Check PIN authorization
```

### Connection

```
POST   /api/integrations/plex/connect       # Connect Plex
GET    /api/integrations/plex/connect       # Get status
DELETE /api/integrations/plex/connect       # Disconnect
```

### Sync

```
POST /api/integrations/plex/sync            # Trigger sync
GET  /api/integrations/plex/sync            # Get sync logs
```

## 🔮 Future Features

- [ ] Real-time sync via Plex webhooks
- [ ] Bi-directional sync (mark watched in Plex from Episode Tracker)
- [ ] Automatic scheduled syncs
- [ ] Selective library sync
- [ ] Sync preferences (watched threshold, etc.)
- [ ] Jellyfin integration
- [ ] Emby integration

## ⚙️ Configuration

### Custom Plex Client ID

If you want to use your own Plex Client ID (for branding):

1. Register your app at: https://www.plex.tv/appcast/
2. Get your Client ID
3. Update `.env`:
   ```env
   PLEX_CLIENT_ID=your-custom-client-id
   PLEX_PRODUCT=Your App Name
   ```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PLEX_CLIENT_ID` | No | `episodetracker` | Identifies your app to Plex |
| `PLEX_PRODUCT` | No | `Episode Tracker` | App name in authorization screen |
| `INTEGRATION_ENCRYPTION_KEY` | **YES** | - | 32-char key for token encryption |

## 📚 Resources

- [Plex API Documentation](https://www.plex.tv/api/developers/)
- [Plex OAuth Flow](https://forums.plex.tv/t/authenticating-with-plex/609370)
- [Overseerr Plex Auth Reference](https://github.com/sct/overseerr)

## 🙏 Credits

Plex OAuth implementation inspired by [Overseerr](https://github.com/sct/overseerr).

