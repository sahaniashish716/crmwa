import { describe, it, expect } from 'vitest'
import {
  mergeTagRecurrenceWithFirstWait,
  normalizeTagRecurrence,
  tagRecurrenceInterval,
} from './tag-recurrence-config'
import type { Automation } from '@/types'

describe('normalizeTagRecurrence', () => {
  it('requires enabled true', () => {
    expect(normalizeTagRecurrence({ amount: 3, unit: 'minutes' })).toBeUndefined()
    expect(normalizeTagRecurrence({ enabled: false, amount: 3, unit: 'minutes' })?.enabled).toBe(
      false,
    )
    expect(normalizeTagRecurrence({ enabled: true, amount: '7', unit: 'days' })).toEqual({
      enabled: true,
      amount: 7,
      unit: 'days',
      stop_on_inbound: true,
    })
  })
})

describe('mergeTagRecurrenceWithFirstWait', () => {
  it('copies first root wait interval onto recurrence on save', () => {
    const merged = mergeTagRecurrenceWithFirstWait(
      {
        tag_id: 't1',
        recurrence: { enabled: true, amount: 3, unit: 'minutes' },
      },
      [{ step_type: 'wait', step_config: { amount: 1, unit: 'hours' } }],
    )
    expect(merged.recurrence).toEqual({
      enabled: true,
      amount: 1,
      unit: 'hours',
      stop_on_inbound: true,
    })
  })

  it('supports weeks and months from wait step', () => {
    const merged = mergeTagRecurrenceWithFirstWait(
      { tag_id: 't1', recurrence: { enabled: true, amount: 1, unit: 'minutes' } },
      [{ step_type: 'wait', step_config: { amount: 2, unit: 'weeks' } }],
    )
    expect(merged.recurrence?.unit).toBe('weeks')
    expect(merged.recurrence?.amount).toBe(2)
  })
})

describe('tagRecurrenceInterval', () => {
  const base = {
    id: 'a1',
    account_id: 'acct',
    user_id: 'u1',
    name: 'repeat',
    trigger_type: 'tag_added',
    is_active: true,
  } as Automation

  it('returns null when recurrence disabled', () => {
    expect(
      tagRecurrenceInterval({
        ...base,
        trigger_config: {
          tag_id: 't1',
          recurrence: { enabled: false, amount: 3, unit: 'minutes' },
        },
      } as Automation),
    ).toBeNull()
  })

  it('reads days from trigger_config', () => {
    expect(
      tagRecurrenceInterval({
        ...base,
        trigger_config: {
          tag_id: 't1',
          recurrence: { enabled: true, amount: 30, unit: 'days' },
        },
      } as Automation),
    ).toEqual({ amount: 30, unit: 'days' })
  })
})
