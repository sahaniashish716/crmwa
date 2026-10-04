import { describe, it, expect } from 'vitest'
import { computeWaitRunAt, formatWaitDetail } from './wait-scheduler'

describe('computeWaitRunAt', () => {
  const from = new Date('2026-01-15T10:00:00.000Z')

  it('adds minutes', () => {
    expect(computeWaitRunAt({ amount: 5, unit: 'minutes' }, from)).toBe(
      '2026-01-15T10:05:00.000Z',
    )
  })

  it('adds days for 7-day tag follow-up', () => {
    expect(computeWaitRunAt({ amount: 7, unit: 'days' }, from)).toBe(
      '2026-01-22T10:00:00.000Z',
    )
  })

  it('adds weeks', () => {
    expect(computeWaitRunAt({ amount: 2, unit: 'weeks' }, from)).toBe(
      '2026-01-29T10:00:00.000Z',
    )
  })

  it('adds calendar months (6-month nurture)', () => {
    expect(computeWaitRunAt({ amount: 6, unit: 'months' }, from)).toBe(
      '2026-07-15T10:00:00.000Z',
    )
  })

  it('adds 30 days', () => {
    expect(computeWaitRunAt({ amount: 30, unit: 'days' }, from)).toBe(
      '2026-02-14T10:00:00.000Z',
    )
  })
})

describe('formatWaitDetail', () => {
  it('includes run_at for logs', () => {
    const from = new Date('2026-01-15T10:00:00.000Z')
    const detail = formatWaitDetail({ amount: 1, unit: 'days' })
    expect(detail).toContain('waiting 1 days')
    expect(detail).toContain('until')
    expect(computeWaitRunAt({ amount: 1, unit: 'days' }, from)).toBe(
      '2026-01-16T10:00:00.000Z',
    )
  })
})
