import { describe, it, expect, vi } from 'vitest'
import { bumpConversationOnInbound } from './bump-conversation-on-inbound'

describe('bumpConversationOnInbound', () => {
  it('uses RPC when available', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const admin = { rpc, from: vi.fn() }

    await bumpConversationOnInbound(admin as never, 'conv-1', 'hello')

    expect(rpc).toHaveBeenCalledWith('bump_conversation_on_inbound', {
      p_conversation_id: 'conv-1',
      p_last_message_text: 'hello',
    })
  })

  it('falls back to direct UPDATE when RPC is missing', async () => {
    const update = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    })
    const admin = {
      rpc: vi.fn().mockResolvedValue({
        error: { message: 'function bump_conversation_on_inbound does not exist' },
      }),
      from: (table: string) => {
        if (table !== 'conversations') throw new Error(table)
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { unread_count: 2 }, error: null }),
            }),
          }),
          update,
        }
      },
    }

    await bumpConversationOnInbound(admin as never, 'conv-1', '  ')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        unread_count: 3,
        last_message_text: '[message]',
      }),
    )
  })
})
