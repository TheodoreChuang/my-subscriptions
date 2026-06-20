import type { Logger } from '@/shared/capabilities/logger'

class ConsoleLogger implements Logger {
  info(message: string, context?: Record<string, unknown>): void {
    console.info(message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    console.error(message, context)
  }
}

export const logger: Logger = new ConsoleLogger()
