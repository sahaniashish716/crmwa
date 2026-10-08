import { describe, it, expect } from 'vitest'
import {
  isMissingBroadcastTemplateParamsColumn,
  recipientParamsForSend,
} from './template-params-schema'

describe('isMissingBroadcastTemplateParamsColumn', () => {
  it('detects schema cache errors', () => {
    expect(
      isMissingBroadcastTemplateParamsColumn(
        "Could not find the 'template_params' column of 'broadcast_recipients' in the schema cache",
      ),
    ).toBe(true)
    expect(isMissingBroadcastTemplateParamsColumn('duplicate key')).toBe(false)
  })
})

describe('recipientParamsForSend', () => {
  it('prefers in-memory params when column was not persisted', () => {
    const map = new Map([['c1', ['Alice', 'Acme']]])
    expect(recipientParamsForSend('c1', map, null)).toEqual(['Alice', 'Acme'])
    expect(recipientParamsForSend('c1', map, ['Old'])).toEqual(['Alice', 'Acme'])
  })
})
