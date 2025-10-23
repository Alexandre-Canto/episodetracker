import jwt from 'jsonwebtoken'
import { logger } from './logger'

const JWT_SECRET = process.env.JWT_SECRET || 'build-time-placeholder-secret-min-32-chars'
const JWT_ISSUER = 'episodetracker'
const JWT_AUDIENCE = 'episodetracker-api'

// Validate JWT secret is strong enough (only at runtime, not during build)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Only validate on server-side at runtime
  const checkSecret = () => {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      logger.error('JWT_SECRET is not set or is too weak (must be at least 32 characters)')
      throw new Error('Invalid JWT_SECRET configuration')
    }
  }
  
  // Delay validation until first use, not during module load
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET) {
    checkSecret()
  }
}

export interface JWTPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
  iss?: string
  aud?: string
}

/**
 * Generate a secure JWT token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    }
  )
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    }) as JWTPayload

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('JWT token expired')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { error: error.message })
    } else {
      logger.error('JWT verification error', error)
    }
    return null
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Refresh a token (issue a new one before expiry)
 */
export function refreshToken(oldToken: string): string | null {
  const payload = verifyToken(oldToken)
  if (!payload) {
    return null
  }

  // Issue a new token with the same payload
  return generateToken({
    userId: payload.userId,
    email: payload.email,
  })
}
