import { describe, it, expect } from 'vitest'
import { parseWhatsAppDeliveryError, whatsAppDeliveryHint } from './delivery-errors'

describe('parseWhatsAppDeliveryError', () => {
  it('parses webhook-formatted broadcast errors', () => {
    const parsed = parseWhatsAppDeliveryError(
      '[131049] This message was not delivered to maintain healthy ecosystem engagement.: In order to maintain a healthy ecosystem engagement, the message failed to be delivered.',
    )
    expect(parsed?.code).toBe(131049)
    expect(parsed?.title).toContain('healthy ecosystem')
  })
})

describe('whatsAppDeliveryHint', () => {
  it('explains common Meta codes', () => {
    expect(whatsAppDeliveryHint(131049)).toContain('marketing')
    expect(whatsAppDeliveryHint(131026)).toContain('not on WhatsApp')
  })
})
