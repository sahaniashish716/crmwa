import { describe, it, expect, vi } from 'vitest'
import { insertInboundCustomerMessage } from './insert-inbound-message'

describe('insertInboundCustomerMessage', () => {
  const baseRow = {
    conversation_id: 'c1',
    sender_type: 'customer' as const,
    content_type: 'text',
    content_text: 'hi',
    media_url: null,
    media_type: null,
    message_id: 'wamid.1',
    status: 'delivered' as const,
    created_at: '2026-10-11T00:00:00.000Z',
    reply_to_message_id: null,
    interactive_reply_id: null,
  }

  it('retries without optional columns on PGRST204', async () => {
    const upsertCalls: Record<string, unknown>[] = []
    const admin = {
      from: () => ({
        upsert: (row: Record<string, unknown>) => {
          upsertCalls.push(row)
          const fail = upsertCalls.length === 1
          return {
            select: () =>
              Promise.resolve({
                data: fail ? null : [{ id: 'msg-1' }],
                error: fail
                  ? { code: 'PGRST204', message: "Column 'media_type' of relation 'messages' does not exist" }
                  : null,
              }),
          }
        },
      }),
    }

    const { insertedIds, error } = await insertInboundCustomerMessage(
      admin as never,
      baseRow,
    )

    expect(error).toBeNull()
    expect(insertedIds).toEqual([{ id: 'msg-1' }])
    expect(upsertCalls[0]).toHaveProperty('media_type')
    expect(upsertCalls[1]).not.toHaveProperty('media_type')
  })

  it('returns non-PGRST204 errors immediately', async () => {
    const admin = {
      from: () => ({
        upsert: () => ({
          select: () =>
            Promise.resolve({
              data: null,
              error: { code: '23505', message: 'duplicate key' },
            }),
        }),
      }),
    }

    const { insertedIds, error } = await insertInboundCustomerMessage(
      admin as never,
      baseRow,
    )

    expect(insertedIds).toBeNull()
    expect(error?.code).toBe('23505')
  })
})
