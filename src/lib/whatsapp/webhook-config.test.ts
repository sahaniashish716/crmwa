import { describe, it, expect, vi } from 'vitest'
import { resolveWhatsappConfigForInbound } from './webhook-config'

describe('resolveWhatsappConfigForInbound', () => {
  it('falls back to waba_id and syncs phone_number_id', async () => {
    const update = vi.fn().mockResolvedValue({ error: null })
    const configRow = {
      id: 'cfg-1',
      account_id: 'acc-1',
      user_id: 'u-1',
      phone_number_id: 'OLD_ID',
      waba_id: 'WABA-99',
    }
    const admin = {
      from: (table: string) => {
        if (table !== 'whatsapp_config') throw new Error(table)
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'phone_number_id' && val === 'NEW_ID') {
                return Promise.resolve({ data: [], error: null })
              }
              if (col === 'waba_id' && val === 'WABA-99') {
                return Promise.resolve({ data: [configRow], error: null })
              }
              return Promise.resolve({ data: [], error: null })
            },
          }),
          update: (payload: unknown) => ({
            eq: () => {
              update(payload)
              return Promise.resolve({ error: null })
            },
          }),
        }
      },
    }

    const resolved = await resolveWhatsappConfigForInbound(
      admin as never,
      'NEW_ID',
      'WABA-99',
    )

    expect(resolved?.phone_number_id).toBe('NEW_ID')
    expect(update).toHaveBeenCalledWith({ phone_number_id: 'NEW_ID' })
  })

  it('binds a sole connected config when waba_id was never saved', async () => {
    const legacyRow = {
      id: 'cfg-legacy',
      account_id: 'acc-1',
      user_id: 'u-1',
      phone_number_id: 'OLD_ID',
      waba_id: null,
      status: 'connected',
    }
    const update = vi.fn().mockResolvedValue({ error: null })
    const admin = {
      from: (table: string) => {
        if (table !== 'whatsapp_config') throw new Error(table)
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'phone_number_id') {
                return Promise.resolve({ data: [], error: null })
              }
              if (col === 'waba_id') {
                return Promise.resolve({ data: [], error: null })
              }
              if (col === 'status' && val === 'connected') {
                return {
                  is: () =>
                    Promise.resolve({ data: [legacyRow], error: null }),
                }
              }
              return Promise.resolve({ data: [], error: null })
            },
            is: (col: string, val: null) => {
              if (col === 'waba_id' && val === null) {
                return {
                  eq: () =>
                    Promise.resolve({ data: [legacyRow], error: null }),
                }
              }
              return Promise.resolve({ data: [], error: null })
            },
          }),
          update: (payload: unknown) => ({
            eq: () => {
              update(payload)
              return Promise.resolve({ error: null })
            },
          }),
        }
      },
    }

    const resolved = await resolveWhatsappConfigForInbound(
      admin as never,
      'META_PNID',
      'WABA-NEW',
    )

    expect(resolved?.id).toBe('cfg-legacy')
    expect(update).toHaveBeenCalledWith({
      phone_number_id: 'META_PNID',
      waba_id: 'WABA-NEW',
    })
  })
})
