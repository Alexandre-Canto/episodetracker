import axios from 'axios'
import crypto from 'crypto'

const PLEX_CLIENT_ID = process.env.PLEX_CLIENT_ID || 'episodetracker'
const PLEX_PRODUCT = process.env.PLEX_PRODUCT || 'Episode Tracker'
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY!

// Plex API URLs
const PLEX_TV_URL = 'https://plex.tv'
const PLEX_PIN_URL = `${PLEX_TV_URL}/api/v2/pins`

export interface PlexAuthPin {
  id: number
  code: string
  authToken: string | null
}

export interface PlexUser {
  id: number
  username: string
  email: string
  authToken: string
}

export interface PlexServer {
  name: string
  host: string
  port: number
  machineIdentifier: string
  accessToken: string
  connections: Array<{
    uri: string
    local: boolean
  }>
}

export interface PlexLibrary {
  key: string
  type: string
  title: string
  agent: string
  scanner: string
}

export interface PlexShow {
  ratingKey: string
  key: string
  guid: string
  title: string
  year: number
  thumb: string
  art: string
  summary: string
  leafCount: number // Total episodes
  viewedLeafCount: number // Watched episodes
  childCount: number // Total seasons
}

export interface PlexSeason {
  ratingKey: string
  key: string
  parentRatingKey: string
  title: string
  index: number // Season number
  leafCount: number // Total episodes
  viewedLeafCount: number // Watched episodes
}

export interface PlexEpisode {
  ratingKey: string
  key: string
  parentRatingKey: string
  grandparentRatingKey: string
  title: string
  grandparentTitle: string // Show title
  parentTitle: string // Season title
  index: number // Episode number
  parentIndex: number // Season number
  year: number
  thumb: string
  summary: string
  viewCount: number
  lastViewedAt: number | null
  guid: string
  guids?: Array<{ id: string }> // External IDs (tmdb, tvdb, etc)
}

// Encryption utilities
export function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be exactly 32 characters')
  }
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export function decryptToken(encryptedToken: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be exactly 32 characters')
  }
  const parts = encryptedToken.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Plex OAuth flow (like Overseerr)
export class PlexAPI {
  private baseHeaders = {
    'X-Plex-Product': PLEX_PRODUCT,
    'X-Plex-Version': '1.0',
    'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
    'Accept': 'application/json'
  }

  // Step 1: Generate a PIN for OAuth
  async generatePin(): Promise<PlexAuthPin> {
    const response = await axios.post(
      PLEX_PIN_URL,
      {
        strong: true,
        'X-Plex-Product': PLEX_PRODUCT,
        'X-Plex-Client-Identifier': PLEX_CLIENT_ID
      },
      { headers: this.baseHeaders }
    )

    return {
      id: response.data.id,
      code: response.data.code,
      authToken: response.data.authToken
    }
  }

  // Step 2: Get the PIN URL for user to authorize
  getAuthUrl(pinId: number, code: string): string {
    return `https://app.plex.tv/auth#?clientID=${PLEX_CLIENT_ID}&code=${code}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(PLEX_PRODUCT)}`
  }

  // Step 3: Check if PIN has been authorized
  async checkPin(pinId: number): Promise<PlexAuthPin> {
    const response = await axios.get(`${PLEX_PIN_URL}/${pinId}`, {
      headers: this.baseHeaders
    })

    return {
      id: response.data.id,
      code: response.data.code,
      authToken: response.data.authToken
    }
  }

  // Get user info from auth token
  async getUserInfo(authToken: string): Promise<PlexUser> {
    const response = await axios.get(`${PLEX_TV_URL}/api/v2/user`, {
      headers: {
        ...this.baseHeaders,
        'X-Plex-Token': authToken
      }
    })

    return {
      id: response.data.id,
      username: response.data.username,
      email: response.data.email,
      authToken
    }
  }

  // Get user's Plex servers
  async getServers(authToken: string): Promise<PlexServer[]> {
    const response = await axios.get(`${PLEX_TV_URL}/api/v2/resources?includeHttps=1&includeRelay=1`, {
      headers: {
        ...this.baseHeaders,
        'X-Plex-Token': authToken
      }
    })

    return response.data
      .filter((resource: any) => resource.provides === 'server')
      .map((server: any) => ({
        name: server.name,
        host: server.connections[0]?.uri || '',
        port: server.connections[0]?.port || 32400,
        machineIdentifier: server.clientIdentifier,
        accessToken: server.accessToken,
        connections: server.connections
      }))
  }

  // Get TV show libraries from server
  async getTVLibraries(serverUrl: string, accessToken: string): Promise<PlexLibrary[]> {
    const response = await axios.get(`${serverUrl}/library/sections`, {
      headers: {
        ...this.baseHeaders,
        'X-Plex-Token': accessToken
      }
    })

    return response.data.MediaContainer.Directory
      .filter((lib: any) => lib.type === 'show')
      .map((lib: any) => ({
        key: lib.key,
        type: lib.type,
        title: lib.title,
        agent: lib.agent,
        scanner: lib.scanner
      }))
  }

  // Get all TV shows from a library
  async getShows(serverUrl: string, accessToken: string, libraryKey: string): Promise<PlexShow[]> {
    const response = await axios.get(`${serverUrl}/library/sections/${libraryKey}/all`, {
      headers: {
        ...this.baseHeaders,
        'X-Plex-Token': accessToken
      }
    })

    return response.data.MediaContainer.Metadata.map((show: any) => ({
      ratingKey: show.ratingKey,
      key: show.key,
      guid: show.guid,
      title: show.title,
      year: show.year,
      thumb: show.thumb,
      art: show.art,
      summary: show.summary,
      leafCount: show.leafCount,
      viewedLeafCount: show.viewedLeafCount,
      childCount: show.childCount
    }))
  }

  // Get seasons for a show
  async getSeasons(serverUrl: string, accessToken: string, showKey: string): Promise<PlexSeason[]> {
    const response = await axios.get(`${serverUrl}${showKey}`, {
      headers: {
        ...this.baseHeaders,
        'X-Plex-Token': accessToken
      }
    })

    return response.data.MediaContainer.Metadata.map((season: any) => ({
      ratingKey: season.ratingKey,
      key: season.key,
      parentRatingKey: season.parentRatingKey,
      title: season.title,
      index: season.index,
      leafCount: season.leafCount,
      viewedLeafCount: season.viewedLeafCount
    }))
  }

  // Get episodes for a season or show
  async getEpisodes(serverUrl: string, accessToken: string, key: string): Promise<PlexEpisode[]> {
    const response = await axios.get(`${serverUrl}${key}`, {
      headers: {
        ...this.baseHeaders,
        'X-Plex-Token': accessToken
      }
    })

    return response.data.MediaContainer.Metadata.map((episode: any) => ({
      ratingKey: episode.ratingKey,
      key: episode.key,
      parentRatingKey: episode.parentRatingKey,
      grandparentRatingKey: episode.grandparentRatingKey,
      title: episode.title,
      grandparentTitle: episode.grandparentTitle,
      parentTitle: episode.parentTitle,
      index: episode.index,
      parentIndex: episode.parentIndex,
      year: episode.year,
      thumb: episode.thumb,
      summary: episode.summary,
      viewCount: episode.viewCount || 0,
      lastViewedAt: episode.lastViewedAt || null,
      guid: episode.guid,
      guids: episode.Guid || []
    }))
  }

  // Get all watched episodes for a library
  async getWatchedEpisodes(serverUrl: string, accessToken: string, libraryKey: string): Promise<PlexEpisode[]> {
    const response = await axios.get(
      `${serverUrl}/library/sections/${libraryKey}/all?type=4&viewCount>=1`,
      {
        headers: {
          ...this.baseHeaders,
          'X-Plex-Token': accessToken
        }
      }
    )

    if (!response.data.MediaContainer.Metadata) {
      return []
    }

    return response.data.MediaContainer.Metadata.map((episode: any) => ({
      ratingKey: episode.ratingKey,
      key: episode.key,
      parentRatingKey: episode.parentRatingKey,
      grandparentRatingKey: episode.grandparentRatingKey,
      title: episode.title,
      grandparentTitle: episode.grandparentTitle,
      parentTitle: episode.parentTitle,
      index: episode.index,
      parentIndex: episode.parentIndex,
      year: episode.year,
      thumb: episode.thumb,
      summary: episode.summary,
      viewCount: episode.viewCount || 0,
      lastViewedAt: episode.lastViewedAt || null,
      guid: episode.guid,
      guids: episode.Guid || []
    }))
  }

  // Extract external IDs (TMDB, TVDB) from Plex GUID
  extractExternalIds(guid: string, guids?: Array<{ id: string }>): { tmdb?: number; tvdb?: number; imdb?: string } {
    const ids: { tmdb?: number; tvdb?: number; imdb?: string } = {}

    // Try new Guid array format first
    if (guids && guids.length > 0) {
      for (const guidObj of guids) {
        const id = guidObj.id
        if (id.startsWith('tmdb://')) {
          ids.tmdb = parseInt(id.replace('tmdb://', ''))
        } else if (id.startsWith('tvdb://')) {
          ids.tvdb = parseInt(id.replace('tvdb://', ''))
        } else if (id.startsWith('imdb://')) {
          ids.imdb = id.replace('imdb://', '')
        }
      }
    }

    // Fallback to old guid format
    if (guid) {
      if (guid.includes('themoviedb://')) {
        const match = guid.match(/themoviedb:\/\/(\d+)/)
        if (match) ids.tmdb = parseInt(match[1])
      } else if (guid.includes('thetvdb://')) {
        const match = guid.match(/thetvdb:\/\/(\d+)/)
        if (match) ids.tvdb = parseInt(match[1])
      } else if (guid.includes('imdb://')) {
        const match = guid.match(/imdb:\/\/(tt\d+)/)
        if (match) ids.imdb = match[1]
      }
    }

    return ids
  }
}

export const plexAPI = new PlexAPI()

