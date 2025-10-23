/**
 * Rate limiting middleware using Redis
 * Protects API endpoints from abuse
 */

import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet } from './redis'
import { logger } from './logger'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyPrefix?: string // Redis key prefix
}

/**
 * Get client IP address from request, considering reverse proxy headers
 */
export function getClientIp(request: NextRequest): string {
  // Check common reverse proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare
  
  if (cfConnectingIp) return cfConnectingIp
  if (realIp) return realIp
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, use the first one
    return forwardedFor.split(',')[0].trim()
  }
  
  // Fallback (should not happen behind nginx)
  return 'unknown'
}

/**
 * Rate limit middleware factory
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'ratelimit' } = config

  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      const clientIp = getClientIp(request)
      const key = `${keyPrefix}:${clientIp}`
      
      // Get current count
      const currentStr = await cacheGet(key)
      const current = currentStr ? parseInt(currentStr, 10) : 0

      if (current >= maxRequests) {
        logger.security('Rate limit exceeded', {
          ip: clientIp,
          endpoint: request.nextUrl.pathname,
          requests: current,
          limit: maxRequests,
        })

        return NextResponse.json(
          { 
            error: 'Too many requests',
            message: 'You have exceeded the rate limit. Please try again later.',
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(windowMs / 1000)),
              'X-RateLimit-Limit': String(maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Date.now() + windowMs),
            },
          }
        )
      }

      // Increment counter
      await cacheSet(key, String(current + 1), Math.ceil(windowMs / 1000))

      return null // Allow request to proceed
    } catch (error) {
      // If rate limiting fails, log but don't block the request
      logger.error('Rate limiting error', error)
      return null
    }
  }
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const rateLimiters = {
  // Strict limit for authentication endpoints (5 requests per 15 minutes)
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'ratelimit:auth',
  }),

  // API endpoints (100 requests per minute)
  api: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'ratelimit:api',
  }),

  // Expensive operations like sync (10 requests per hour)
  sync: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:sync',
  }),

  // AI recommendations (5 requests per hour)
  ai: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'ratelimit:ai',
  }),
}

