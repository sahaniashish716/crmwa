import { describe, it, expect } from 'vitest'
import { computeNextScheduledRunAt } from './bootstrap-tag-automation-on-activate'

describe('computeNextScheduledRunAt', () => {
  it('returns future slot when anchor + interval is still ahead', () => {
    const anchor = new Date('2026-10-01T12:00:00.000Z')
    const now = new Date('2026-10-05T12:00:00.000Z')
    const { runAt, isOverdue } = computeNextScheduledRunAt(
      anchor,
      { amount: 7, unit: 'days' },
      now,
    )
    expect(isOverdue).toBe(false)
    expect(runAt.toISOString()).toBe('2026-10-08T12:00:00.000Z')
  })

  it('marks overdue when the scheduled time has passed', () => {
    const anchor = new Date('2026-10-01T12:00:00.000Z')
    const now = new Date('2026-10-10T12:00:00.000Z')
    const { isOverdue } = computeNextScheduledRunAt(
      anchor,
      { amount: 7, unit: 'days' },
      now,
    )
    expect(isOverdue).toBe(true)
  })
})
