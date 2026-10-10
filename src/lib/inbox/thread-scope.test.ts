import { describe, it, expect } from 'vitest'
import { dedupeConversationsByContact } from './thread-scope'
import type { Conversation } from '@/types'

describe('dedupeConversationsByContact', () => {
  it('keeps the conversation with the newer last_message_at', () => {
    const older: Conversation = {
      id: 'c-old',
      contact_id: 'contact-1',
      last_message_at: '2026-01-01T00:00:00Z',
      last_message_text: 'old',
    } as Conversation
    const newer: Conversation = {
      id: 'c-new',
      contact_id: 'contact-1',
      last_message_at: '2026-03-01T00:00:00Z',
      last_message_text: 'hi',
    } as Conversation

    const out = dedupeConversationsByContact([older, newer])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('c-new')
  })
})
