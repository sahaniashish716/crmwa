import { describe, it, expect } from 'vitest'
import { isScheduleDue } from './schedule'

describe('isScheduleDue', () => {
  it('matches daily HH:mm in UTC', () => {
    const now = new Date('2026-03-20T09:00:00.000Z')
    expect(isScheduleDue('09:00', 'UTC', null, now)).toBe(true)
    expect(isScheduleDue('09:01', 'UTC', null, now)).toBe(false)
  })

  it('matches a simple cron expression', () => {
    const now = new Date('2026-03-20T09:00:00.000Z')
    expect(isScheduleDue('0 9 * * *', 'UTC', null, now)).toBe(true)
    expect(isScheduleDue('30 9 * * *', 'UTC', null, now)).toBe(false)
  })

  it('does not double-fire within the same minute', () => {
    const now = new Date('2026-03-20T09:00:30.000Z')
    const last = '2026-03-20T09:00:05.000Z'
    expect(isScheduleDue('09:00', 'UTC', last, now)).toBe(false)
  })

  it('treats star-slash-N cron as every N minutes since last run', () => {
    const now = new Date('2026-03-20T09:07:00.000Z')
    expect(isScheduleDue('*/5 * * * *', 'UTC', null, now)).toBe(true)
    const last = '2026-03-20T09:01:00.000Z'
    expect(isScheduleDue('*/5 * * * *', 'UTC', last, now)).toBe(true)
    const recent = '2026-03-20T09:04:30.000Z'
    expect(isScheduleDue('*/5 * * * *', 'UTC', recent, now)).toBe(false)
  })
})
