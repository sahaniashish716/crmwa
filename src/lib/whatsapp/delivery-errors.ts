/** Parse `[code] title: details` stored on broadcast_recipients.error_message. */
export function parseWhatsAppDeliveryError(raw: string | null | undefined): {
  code: number | null
  title: string
  details: string
  raw: string
} | null {
  if (!raw?.trim()) return null
  const m = raw.match(/^\[(\d+)\]\s*(.*?)(?::\s*([\s\S]*))?$/)
  if (!m) return { code: null, title: raw.trim(), details: '', raw }
  return {
    code: Number(m[1]),
    title: (m[2] ?? '').trim(),
    details: (m[3] ?? '').trim(),
    raw,
  }
}

/** Plain-language guidance for agents (Meta docs + common support cases). */
export function whatsAppDeliveryHint(code: number | null): string | null {
  switch (code) {
    case 131049:
      return (
        'WhatsApp blocked this marketing/template message to protect engagement quality ' +
        '(per-user marketing limit or low recent interaction). Wait 24–72 hours; do not spam Retry. ' +
        'Ask the contact to message you first, or send only within the 24h service window with a non-marketing message.'
      )
    case 131026:
      return (
        'Number cannot receive this message (not on WhatsApp, invalid, blocked you, or region restriction). ' +
        'Verify the phone in E.164 format; retry only after the contact confirms they use WhatsApp.'
      )
    case 131047:
      return (
        'Re-engagement window closed. The contact must send you a WhatsApp message first ' +
        'before you can send template/marketing messages again.'
      )
    case 131051:
      return 'Message type not supported for this recipient or template category.'
    case 130472:
      return "User's number is part of an experiment — retry later or use another channel."
    default:
      return null
  }
}
