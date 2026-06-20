import { describe, expect, it } from 'vitest'
import { logger } from '@/infrastructure/logger'
import type { Logger } from '@/shared/capabilities/logger'

describe('logger', () => {
  it('info does not throw with context', () => {
    expect(() => logger.info('msg', { key: 'val' })).not.toThrow()
  })

  it('warn does not throw without context', () => {
    expect(() => logger.warn('msg')).not.toThrow()
  })

  it('error does not throw with context', () => {
    expect(() => logger.error('msg', { err: 'x' })).not.toThrow()
  })

  it('ConsoleLogger satisfies the Logger interface', () => {
    const typed: Logger = logger
    expect(typed).toBeDefined()
  })
})
