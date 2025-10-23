import { NextRequest } from 'next/server'
import { verifyToken, extractTokenFromHeader } from './jwt'
import { prisma } from './db'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
}

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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true
      }
    })

    return user
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

export function requireAuth(handler: (request: NextRequest, user: AuthenticatedUser, context?: any) => Promise<Response>) {
  return async (request: NextRequest, context?: any) => {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return handler(request, user, context)
  }
}
