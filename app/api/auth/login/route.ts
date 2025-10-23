import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { generateToken } from '@/lib/jwt'
import { logger } from '@/lib/logger'
import { rateLimiters, getClientIp } from '@/lib/rate-limit'
import { isValidEmail } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const clientIp = getClientIp(request)

  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.auth(request)
    if (rateLimitResponse) return rateLimitResponse

    const { email, password } = await request.json()

    if (!email || !password) {
      logger.warn('Login attempt with missing fields', { ip: clientIp })
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      logger.warn('Login attempt with invalid email format', { ip: clientIp })
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      logger.security('Login attempt with non-existent email', { ip: clientIp, email })
      // Use same error message as invalid password to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      logger.security('Failed login attempt', { ip: clientIp, email, userId: user.id })
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email
    })

    logger.info('User logged in successfully', { 
      userId: user.id, 
      email: user.email,
      ip: clientIp
    })

    logger.performance('Login', Date.now() - startTime)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    })
  } catch (error) {
    logger.error('Login error', error, { ip: clientIp })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
