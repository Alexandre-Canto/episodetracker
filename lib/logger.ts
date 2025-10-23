/**
 * Production-ready logging utility
 * Uses structured logging for better monitoring and debugging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage('info', message, context))
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context))
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        errorMessage: error.message,
        errorStack: this.isProduction ? undefined : error.stack,
      }),
    }
    console.error(this.formatMessage('error', message, errorContext))
  }

  /**
   * Log security events (authentication, authorization, suspicious activity)
   */
  security(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', `[SECURITY] ${message}`, context))
  }

  /**
   * Log performance metrics
   */
  performance(message: string, duration: number, context?: LogContext): void {
    if (duration > 1000) {
      this.warn(`[PERFORMANCE] ${message}`, { ...context, duration: `${duration}ms` })
    } else if (this.isDevelopment) {
      this.debug(`[PERFORMANCE] ${message}`, { ...context, duration: `${duration}ms` })
    }
  }
}

export const logger = new Logger()

