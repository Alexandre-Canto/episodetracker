import { NextRequest } from 'next/server'
import { verifyToken, extractTokenFromHeader } from './jwt'
import { prisma } from './db'
import { logger } from './logger'
import { getClientIp } from './rate-limit'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
}

/**
 * Get authenticated user from request
 * Returns null if authentication fails
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader || undefined)

    if (!token) {
      return null
    }

    const payload = verifyToken(token)
    if (!payload) {
      return null
    }

    // Fetch user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true
      }
    })

    if (!user) {
      logger.security('JWT token valid but user not found', { 
        userId: payload.userId,
        email: payload.email 
      })
      return null
    }

    return user
  } catch (error) {
    logger.error('Authentication error', error)
    return null
  }
}

/**
 * Middleware to require authentication for an API route
 */
export function requireAuth(handler: (request: NextRequest, user: AuthenticatedUser, context?: any) => Promise<Response>) {
  return async (request: NextRequest, context?: any) => {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      const clientIp = getClientIp(request)
      logger.security('Unauthorized access attempt', {
        ip: clientIp,
        path: request.nextUrl.pathname,
        method: request.method,
      })

      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }

    return handler(request, user, context)
  }
}
