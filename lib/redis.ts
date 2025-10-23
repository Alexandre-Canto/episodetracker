import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedisClient(): Redis | null {
  // If Redis URL is not configured, return null (caching disabled)
  if (!process.env.REDIS_URL) {
    console.log('[REDIS] Redis URL not configured, caching disabled')
    return null
  }

  // Return existing client if already created
  if (redis) {
    return redis
  }

  try {
    console.log('[REDIS] Initializing Redis client...')
    console.log('[REDIS] Redis URL:', process.env.REDIS_URL)
    
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      lazyConnect: true,
    })

    redis.on('connect', () => {
      console.log('[REDIS] ✅ Connected to Redis')
    })

    redis.on('error', (err) => {
      console.error('[REDIS] ❌ Redis error:', err.message)
    })

    redis.on('close', () => {
      console.log('[REDIS] Connection closed')
    })

    // Connect immediately
    redis.connect().catch((err) => {
      console.error('[REDIS] ❌ Failed to connect:', err.message)
      redis = null
    })

    return redis
  } catch (error: any) {
    console.error('[REDIS] ❌ Failed to initialize Redis client:', error.message)
    return null
  }
}

// Helper functions for common cache operations
export async function cacheGet(key: string): Promise<string | null> {
  const client = getRedisClient()
  if (!client) return null

  try {
    const value = await client.get(key)
    if (value) {
      console.log(`[REDIS] ✅ Cache HIT for key: ${key}`)
    } else {
      console.log(`[REDIS] ❌ Cache MISS for key: ${key}`)
    }
    return value
  } catch (error: any) {
    console.error(`[REDIS] Error getting key ${key}:`, error.message)
    return null
  }
}

export async function cacheSet(key: string, value: string, ttl?: number): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    if (ttl) {
      await client.setex(key, ttl, value)
      console.log(`[REDIS] ✅ Cached key: ${key} (TTL: ${ttl}s)`)
    } else {
      await client.set(key, value)
      console.log(`[REDIS] ✅ Cached key: ${key} (no expiry)`)
    }
    return true
  } catch (error: any) {
    console.error(`[REDIS] Error setting key ${key}:`, error.message)
    return false
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    await client.del(key)
    console.log(`[REDIS] ✅ Deleted key: ${key}`)
    return true
  } catch (error: any) {
    console.error(`[REDIS] Error deleting key ${key}:`, error.message)
    return false
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    const exists = await client.exists(key)
    return exists === 1
  } catch (error: any) {
    console.error(`[REDIS] Error checking key ${key}:`, error.message)
    return false
  }
}

