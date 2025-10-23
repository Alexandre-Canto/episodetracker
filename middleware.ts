import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Global middleware for security headers and request processing
 * Runs on all requests before they reach the API routes
 */
export function middleware(request: NextRequest) {
  // Get origin from request
  const origin = request.headers.get('origin')
  
  // Define allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:4000', 'http://localhost:4001','https://episodetracker.homelab-canto.pt']
  
  // Handle CORS for API routes
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')
  
  // For preflight requests
  if (request.method === 'OPTIONS' && isApiRoute) {
    const response = new NextResponse(null, { status: 204 })
    
    // Set CORS headers
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    
    return response
  }

  const response = NextResponse.next()

  // Set CORS headers for API routes
  if (isApiRoute && origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  // Security Headers
  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Enable XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-inline needed for Next.js in dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://image.tmdb.org",
    "font-src 'self' data:",
    "connect-src 'self' https://api.trakt.tv https://api.themoviedb.org https://api.groq.com https://api.openai.com",
    "frame-ancestors 'none'",
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
  
  // Permissions Policy (formerly Feature Policy)
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // HSTS (Strict-Transport-Security) - only in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  return response
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

