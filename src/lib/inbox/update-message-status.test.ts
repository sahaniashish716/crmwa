import { describe, it, expect, vi } from 'vitest'
import { updateMessagesStatusByWamid } from './update-message-status'

describe('updateMessagesStatusByWamid', () => {
  it('retries with status only when error columns missing', async () => {
    const updates: Record<string, unknown>[] = []
    const admin = {
      from: () => ({
        update: (patch: Record<string, unknown>) => {
          updates.push(patch)
          const fail = updates.length === 1
          return {
            eq: () =>
              Promise.resolve({
                error: fail
                  ? { code: 'PGRST204', message: "Column 'error_code' does not exist" }
                  : null,
              }),
          }
        },
      }),
    }

    await updateMessagesStatusByWamid(admin as never, 'wamid.1', 'failed', {
      code: 131049,
      title: 'Test',
      details: null,
    })

    expect(updates).toHaveLength(2)
    expect(updates[0]).toHaveProperty('error_code')
    expect(updates[1]).toEqual({ status: 'failed' })
  })
})
