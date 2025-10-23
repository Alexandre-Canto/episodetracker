import cron from 'node-cron'
import { prisma, Prisma } from './db'
import { syncPlexToDatabase } from './plexSync'

let schedulerInitialized = false
let cronTask: cron.ScheduledTask | null = null

/**
 * Initialize the scheduler for automatic Plex syncs
 * Runs daily at 3 AM for all users with autoSync enabled
 */
export function initializeScheduler() {
  if (schedulerInitialized) {
    console.log('[Scheduler] Already initialized, skipping...')
    return
  }

  // Only run scheduler in production or if explicitly enabled
  const enableScheduler = process.env.ENABLE_SCHEDULER === 'true' || process.env.NODE_ENV === 'production'
  
  if (!enableScheduler) {
    console.log('[Scheduler] Scheduler disabled (set ENABLE_SCHEDULER=true to enable in development)')
    return
  }

  console.log('[Scheduler] Initializing automatic Plex sync scheduler...')

  // Run daily at 3 AM (0 3 * * *)
  cronTask = cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Running scheduled Plex sync at', new Date().toISOString())
    await runScheduledSync()
  })

  // Also run on startup if enabled
  if (process.env.SYNC_ON_STARTUP === 'true') {
    console.log('[Scheduler] Running sync on startup...')
    // Delay by 30 seconds to allow the app to fully initialize
    setTimeout(() => {
      runScheduledSync().catch(error => {
        console.error('[Scheduler] Startup sync failed:', error)
      })
    }, 30000)
  }

  schedulerInitialized = true
  console.log('[Scheduler] Scheduler initialized successfully. Daily sync at 3 AM.')
}

// Auto-initialize when this module is imported (only in Node.js runtime)
if (typeof window === 'undefined') {
  // Delay initialization slightly to ensure all modules are loaded
  setImmediate(() => {
    initializeScheduler()
  })
}

/**
 * Run scheduled sync for all users with autoSync enabled
 */
async function runScheduledSync() {
  try {
    console.log('[Scheduler] Fetching users with autoSync enabled...')

    // Get all integrations with autoSync enabled
    const integrations = await prisma.integration.findMany({
      where: {
        enabled: true,
        autoSync: true,
        provider: 'plex'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    console.log(`[Scheduler] Found ${integrations.length} users with autoSync enabled`)

    if (integrations.length === 0) {
      console.log('[Scheduler] No users with autoSync enabled, skipping sync')
      return
    }

    // Sync each user sequentially to avoid overloading the system
    for (const integration of integrations) {
      try {
        console.log(`[Scheduler] Syncing Plex for user ${integration.user.email}...`)
        
        const result = await syncPlexToDatabase(integration.userId)

        // Create sync log
        await prisma.syncLog.create({
          data: {
            userId: integration.userId,
            provider: 'plex',
            status: result.errors.length > 0 ? 'partial' : 'success',
            showsSynced: result.showsSynced,
            episodesSynced: result.episodesSynced,
            errors: result.errors.length > 0 ? result.errors : Prisma.JsonNull,
            duration: result.duration
          }
        })

        // Update lastSync timestamp
        await prisma.integration.update({
          where: { id: integration.id },
          data: { lastSync: new Date() }
        })

        console.log(`[Scheduler] ✅ Sync completed for ${integration.user.email}:`, {
          shows: result.showsSynced,
          episodes: result.episodesSynced,
          errors: result.errors.length
        })

        // Add a small delay between users to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error: any) {
        console.error(`[Scheduler] ❌ Failed to sync for user ${integration.user.email}:`, error)

        // Log the error
        await prisma.syncLog.create({
          data: {
            userId: integration.userId,
            provider: 'plex',
            status: 'error',
            showsSynced: 0,
            episodesSynced: 0,
            errors: [error.message || 'Unknown error']
          }
        }).catch(logError => {
          console.error(`[Scheduler] Failed to create error log:`, logError)
        })
      }
    }

    console.log('[Scheduler] ✅ Scheduled sync completed for all users')

  } catch (error) {
    console.error('[Scheduler] ❌ Scheduled sync failed:', error)
  }
}

/**
 * Manually trigger a sync (useful for testing)
 */
export async function triggerManualSync() {
  console.log('[Scheduler] Manually triggering sync...')
  await runScheduledSync()
}

