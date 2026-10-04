import { describe, it, expect } from 'vitest'
import { tagRecurrenceInterval, isRecurrenceTickContext, RECURRENCE_TICK_VAR } from './recurrence'
import type { Automation } from '@/types'

describe('tag recurrence config', () => {
  const base = {
    id: 'a1',
    account_id: 'acct',
    user_id: 'u1',
    name: 'repeat',
    trigger_type: 'tag_added',
    is_active: true,
  } as Automation

  it('parses enabled recurrence interval', () => {
    const automation = {
      ...base,
      trigger_config: { tag_id: 't1', recurrence: { enabled: true, amount: 3, unit: 'minutes' } },
    } as Automation
    expect(tagRecurrenceInterval(automation)).toEqual({ amount: 3, unit: 'minutes' })
  })

  it('returns null when recurrence disabled', () => {
    const automation = {
      ...base,
      trigger_config: { tag_id: 't1', recurrence: { enabled: false, amount: 3, unit: 'minutes' } },
    } as Automation
    expect(tagRecurrenceInterval(automation)).toBeNull()
  })

  it('detects recurrence tick context', () => {
    expect(
      isRecurrenceTickContext({ vars: { [RECURRENCE_TICK_VAR]: true } }),
    ).toBe(true)
    expect(isRecurrenceTickContext({})).toBe(false)
  })
})
