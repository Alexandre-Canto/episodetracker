import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { generateToken } from '@/lib/jwt'
import { logger } from '@/lib/logger'
import { rateLimiters, getClientIp } from '@/lib/rate-limit'
import { isValidEmail, isValidPassword } from '@/lib/validation'
import { notifyNewUserSignup } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const clientIp = getClientIp(request)

  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiters.auth(request)
    if (rateLimitResponse) return rateLimitResponse

    const { email, password, name } = await request.json()

    // Validate required fields
    if (!email || !password) {
      logger.warn('Registration attempt with missing fields', { ip: clientIp })
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      logger.warn('Registration attempt with invalid email', { ip: clientIp, email })
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain both letters and numbers' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUser) {
      logger.warn('Registration attempt with existing email', { ip: clientIp, email })
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Hash password with strong salt rounds
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null
      }
    })

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email
    })

    logger.info('User registered successfully', { 
      userId: user.id, 
      email: user.email,
      ip: clientIp
    })

    logger.performance('Registration', Date.now() - startTime)

    // Send Telegram notification (non-blocking)
    notifyNewUserSignup({
      email: user.email,
      name: user.name,
      id: user.id
    }).catch(error => {
      logger.error('Failed to send Telegram notification for new signup', error)
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    })
  } catch (error) {
    logger.error('Registration error', error, { ip: clientIp })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
