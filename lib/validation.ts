/**
 * Input validation utilities
 * Prevents injection attacks and ensures data integrity
 */

import { logger } from './logger'

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 * Minimum 8 characters, at least one letter and one number
 */
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  return hasLetter && hasNumber
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate integer ID
 */
export function isValidId(id: any): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: string | null, limit?: string | null): { page: number; limit: number } {
  const parsedPage = page ? parseInt(page, 10) : 1
  const parsedLimit = limit ? parseInt(limit, 10) : 20

  return {
    page: Math.max(1, Math.min(100, parsedPage)),
    limit: Math.max(1, Math.min(100, parsedLimit)),
  }
}

/**
 * Validate and sanitize request body
 */
export async function validateRequestBody<T>(
  request: Request,
  requiredFields: string[]
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json()

    // Check for required fields
    for (const field of requiredFields) {
      if (!(field in body) || body[field] === null || body[field] === undefined || body[field] === '') {
        return {
          success: false,
          error: `Missing required field: ${field}`,
        }
      }
    }

    return { success: true, data: body as T }
  } catch (error) {
    logger.error('Failed to parse request body', error)
    return {
      success: false,
      error: 'Invalid request body',
    }
  }
}

/**
 * Validate show status
 */
export function isValidShowStatus(status: string): boolean {
  return ['ongoing', 'watchlater', 'ended', 'archived'].includes(status)
}

/**
 * Validate rating value
 */
export function isValidRating(rating: any): boolean {
  return typeof rating === 'number' && rating >= 1 && rating <= 10 && Number.isInteger(rating)
}

/**
 * Rate limit check - prevent abuse
 */
const requestCounts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const record = requestCounts.get(identifier)

  if (!record || now > record.resetAt) {
    requestCounts.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

