import { prisma } from './db'
import { plexAPI, decryptToken, PlexShow, PlexEpisode } from './plex'
import { traktAPI } from './trakt'
import { getTMDBPosterUrl } from './tmdb'

interface SyncResult {
  showsSynced: number
  episodesSynced: number
  errors: string[]
  duration: number
}

export async function syncPlexToDatabase(userId: string): Promise<SyncResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let showsSynced = 0
  let episodesSynced = 0

  try {
    console.log('[Plex Sync] Starting sync for user', userId)

    // Get integration
    const integration = await prisma.integration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'plex'
        }
      }
    })

    if (!integration || !integration.enabled) {
      throw new Error('Plex integration not found or disabled')
    }

    const accessToken = decryptToken(integration.accessToken)
    const serverUrl = integration.serverUrl

    // Get TV libraries
    console.log('[Plex Sync] Fetching TV libraries...')
    const libraries = await plexAPI.getTVLibraries(serverUrl, accessToken)
    console.log(`[Plex Sync] Found ${libraries.length} TV libraries`)

    if (libraries.length === 0) {
      throw new Error('No TV libraries found on Plex server')
    }

    // Process each library
    for (const library of libraries) {
      console.log(`[Plex Sync] Processing library: ${library.title}`)

      try {
        // Get all watched episodes from this library
        const watchedEpisodes = await plexAPI.getWatchedEpisodes(serverUrl, accessToken, library.key)
        console.log(`[Plex Sync] Found ${watchedEpisodes.length} watched episodes in ${library.title}`)

        // Group episodes by show
        const episodesByShow = new Map<string, PlexEpisode[]>()
        for (const episode of watchedEpisodes) {
          const showTitle = episode.grandparentTitle
          if (!episodesByShow.has(showTitle)) {
            episodesByShow.set(showTitle, [])
          }
          episodesByShow.get(showTitle)!.push(episode)
        }

        console.log(`[Plex Sync] Processing ${episodesByShow.size} shows with watched episodes`)

        // Process each show
        for (const [showTitle, episodes] of episodesByShow) {
          try {
            await syncShow(userId, serverUrl, accessToken, showTitle, episodes)
            showsSynced++
            episodesSynced += episodes.length
          } catch (error: any) {
            console.error(`[Plex Sync] Error syncing show ${showTitle}:`, error.message)
            errors.push(`Failed to sync ${showTitle}: ${error.message}`)
          }
        }
      } catch (error: any) {
        console.error(`[Plex Sync] Error processing library ${library.title}:`, error.message)
        errors.push(`Failed to process library ${library.title}: ${error.message}`)
      }
    }

    // Update last sync time
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSync: new Date() }
    })

    const duration = Date.now() - startTime
    console.log(`[Plex Sync] Sync complete: ${showsSynced} shows, ${episodesSynced} episodes in ${duration}ms`)

    return {
      showsSynced,
      episodesSynced,
      errors,
      duration
    }
  } catch (error: any) {
    console.error('[Plex Sync] Fatal error:', error)
    throw error
  }
}

async function syncShow(
  userId: string,
  serverUrl: string,
  accessToken: string,
  showTitle: string,
  watchedEpisodes: PlexEpisode[]
): Promise<void> {
  console.log(`[Plex Sync] Syncing show: ${showTitle}`)

  // Get one episode to extract external IDs
  const sampleEpisode = watchedEpisodes[0]
  const externalIds = plexAPI.extractExternalIds(sampleEpisode.guid, sampleEpisode.guids)

  console.log(`[Plex Sync] External IDs for ${showTitle}:`, externalIds)

  // Try to find the show in our database or Trakt
  let show = null
  let traktShow = null

  // Try TMDB ID first
  if (externalIds.tmdb) {
    traktShow = await traktAPI.getShowByTMDBId(externalIds.tmdb)
  }

  // Try TVDB ID if TMDB didn't work
  if (!traktShow && externalIds.tvdb) {
    traktShow = await traktAPI.getShowByTVDBId(externalIds.tvdb)
  }

  // Fallback to search
  if (!traktShow) {
    console.log(`[Plex Sync] Searching Trakt for: ${showTitle}`)
    const searchResults = await traktAPI.searchShows(showTitle)
    if (searchResults.length > 0) {
      // Find best match by title
      traktShow = searchResults.find((r: any) => 
        r.show.title.toLowerCase() === showTitle.toLowerCase()
      )?.show || searchResults[0].show
    }
  }

  if (!traktShow) {
    throw new Error(`Could not find show on Trakt: ${showTitle}`)
  }

  console.log(`[Plex Sync] Found Trakt show: ${traktShow.title} (ID: ${traktShow.ids.trakt})`)

  // Check if show exists in database
  show = await prisma.show.findUnique({
    where: { traktId: traktShow.ids.trakt }
  })

  // Create show if it doesn't exist
  if (!show) {
    console.log(`[Plex Sync] Creating show in database: ${traktShow.title}`)

    // Get poster from TMDB
    let posterUrl = null
    if (traktShow.ids.tmdb) {
      try {
        posterUrl = await getTMDBPosterUrl(traktShow.ids.tmdb)
      } catch (error) {
        console.error(`[Plex Sync] Failed to fetch poster for ${traktShow.title}`)
      }
    }

    show = await prisma.show.create({
      data: {
        traktId: traktShow.ids.trakt,
        title: traktShow.title,
        overview: traktShow.overview || '',
        poster: posterUrl,
        status: traktShow.status || 'unknown',
        genres: traktShow.genres || [],
        network: traktShow.network || '',
        runtime: traktShow.runtime || 0,
        firstAired: traktShow.first_aired ? new Date(traktShow.first_aired) : null
      }
    })
  }

  // Add show to user's library if not already there
  let userShow = await prisma.userShow.findFirst({
    where: {
      userId,
      showId: show.id
    }
  })

  if (!userShow) {
    console.log(`[Plex Sync] Adding show to user library: ${show.title}`)
    userShow = await prisma.userShow.create({
      data: {
        userId,
        showId: show.id,
        status: 'ongoing'
      }
    })
  }

  // Sync episodes
  console.log(`[Plex Sync] Syncing ${watchedEpisodes.length} watched episodes for ${show.title}`)

  for (const plexEpisode of watchedEpisodes) {
    try {
      await syncEpisode(userId, show.id, traktShow.ids.trakt, plexEpisode)
    } catch (error: any) {
      console.error(`[Plex Sync] Error syncing episode S${plexEpisode.parentIndex}E${plexEpisode.index}:`, error.message)
      // Continue with other episodes
    }
  }
}

async function syncEpisode(
  userId: string,
  showId: string,
  traktShowId: number,
  plexEpisode: PlexEpisode
): Promise<void> {
  const seasonNumber = plexEpisode.parentIndex
  const episodeNumber = plexEpisode.index

  // Find or create season
  let season = await prisma.season.findFirst({
    where: {
      showId,
      seasonNumber
    }
  })

  if (!season) {
    // Fetch season from Trakt
    const traktSeason = await traktAPI.getSeasonEpisodes(traktShowId, seasonNumber)
    
    season = await prisma.season.create({
      data: {
        showId,
        seasonNumber,
        episodeCount: traktSeason.length
      }
    })
  }

  // Find or create episode
  let episode = await prisma.episode.findFirst({
    where: {
      seasonId: season.id,
      episodeNumber
    }
  })

  if (!episode) {
    // Fetch episode details from Trakt
    try {
      const traktEpisode = await traktAPI.getEpisode(traktShowId, seasonNumber, episodeNumber)
      
      episode = await prisma.episode.create({
        data: {
          seasonId: season.id,
          episodeNumber,
          title: traktEpisode.title || `Episode ${episodeNumber}`,
          overview: traktEpisode.overview,
          airDate: traktEpisode.first_aired ? new Date(traktEpisode.first_aired) : null,
          runtime: traktEpisode.runtime
        }
      })
    } catch (error) {
      // If Trakt doesn't have the episode, create a basic one
      episode = await prisma.episode.create({
        data: {
          seasonId: season.id,
          episodeNumber,
          title: plexEpisode.title || `Episode ${episodeNumber}`,
          overview: plexEpisode.summary,
          airDate: plexEpisode.year ? new Date(plexEpisode.year, 0, 1) : null,
          runtime: null
        }
      })
    }
  }

  // Mark as watched
  const watchedAt = plexEpisode.lastViewedAt 
    ? new Date(plexEpisode.lastViewedAt * 1000) 
    : new Date()

  await prisma.userEpisode.upsert({
    where: {
      userId_episodeId: {
        userId,
        episodeId: episode.id
      }
    },
    update: {
      watched: true,
      watchedAt
    },
    create: {
      userId,
      episodeId: episode.id,
      watched: true,
      watchedAt
    }
  })
}

