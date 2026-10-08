import type { SupabaseClient } from '@supabase/supabase-js'

export type WhatsappConfigRow = {
  id: string
  account_id: string
  user_id: string
  phone_number_id: string
  waba_id: string | null
  [key: string]: unknown
}

/**
 * Resolve whatsapp_config for an inbound message webhook.
 * Primary key: metadata.phone_number_id. Fallback: entry WABA id (entry.id),
 * which fixes silent drops when CRM has a stale phone_number_id but outbound
 * sends still work via stored token.
 */
export async function resolveWhatsappConfigForInbound(
  admin: SupabaseClient,
  phoneNumberId: string | undefined,
  wabaId: string | undefined,
): Promise<WhatsappConfigRow | null> {
  const pnid = phoneNumberId?.trim()
  if (pnid) {
    const { data: byPhone, error } = await admin
      .from('whatsapp_config')
      .select('*')
      .eq('phone_number_id', pnid)
    if (error) {
      console.error('[webhook] whatsapp_config lookup by phone_number_id failed:', error)
      return null
    }
    if (byPhone && byPhone.length === 1) {
      return byPhone[0] as WhatsappConfigRow
    }
    if (byPhone && byPhone.length > 1) {
      console.error(
        `[webhook] ${byPhone.length} configs for phone_number_id ${pnid} — inbound dropped`,
      )
      return null
    }
  }

  const waba = wabaId?.trim()
  if (!waba) {
    if (pnid) {
      console.error('[webhook] No whatsapp_config for phone_number_id:', pnid)
    }
    return null
  }

  const { data: byWaba, error: wabaErr } = await admin
    .from('whatsapp_config')
    .select('*')
    .eq('waba_id', waba)

  if (wabaErr) {
    console.error('[webhook] whatsapp_config lookup by waba_id failed:', wabaErr)
    return null
  }

  if (!byWaba || byWaba.length === 0) {
    console.error(
      '[webhook] No whatsapp_config for phone_number_id or waba_id:',
      pnid ?? '(missing)',
      waba,
    )
    return null
  }

  if (byWaba.length > 1) {
    console.error(`[webhook] ${byWaba.length} configs for waba_id ${waba} — inbound dropped`)
    return null
  }

  const config = byWaba[0] as WhatsappConfigRow

  if (pnid && config.phone_number_id !== pnid) {
    console.warn(
      '[webhook] phone_number_id mismatch — updating whatsapp_config from Meta metadata',
      { stored: config.phone_number_id, incoming: pnid, waba_id: waba },
    )
    const { error: updErr } = await admin
      .from('whatsapp_config')
      .update({ phone_number_id: pnid })
      .eq('id', config.id)
    if (updErr) {
      console.error('[webhook] failed to sync phone_number_id:', updErr)
    } else {
      config.phone_number_id = pnid
    }
  }

  return config
}
