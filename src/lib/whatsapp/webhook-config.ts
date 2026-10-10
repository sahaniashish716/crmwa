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
      const config = byPhone[0] as WhatsappConfigRow
      const waba = wabaId?.trim()
      if (waba && config.waba_id !== waba) {
        await syncInboundIdsFromMeta(admin, config, pnid, waba)
      }
      return config
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
    const legacy = await bindLegacyConnectedConfig(admin, pnid, waba)
    if (legacy) return legacy

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

  syncInboundIdsFromMeta(admin, config, pnid, waba)
  return config
}

/** Patch phone_number_id / waba_id on a matched row when Meta metadata differs. */
async function syncInboundIdsFromMeta(
  admin: SupabaseClient,
  config: WhatsappConfigRow,
  phoneNumberId: string | undefined,
  wabaId: string | undefined,
): Promise<void> {
  const pnid = phoneNumberId?.trim()
  const waba = wabaId?.trim()
  const patch: { phone_number_id?: string; waba_id?: string } = {}
  if (pnid && config.phone_number_id !== pnid) patch.phone_number_id = pnid
  if (waba && config.waba_id !== waba) patch.waba_id = waba
  if (Object.keys(patch).length === 0) return

  console.warn('[webhook] syncing whatsapp_config from Meta webhook metadata', {
    config_id: config.id,
    stored: { phone_number_id: config.phone_number_id, waba_id: config.waba_id },
    incoming: { phone_number_id: pnid ?? null, waba_id: waba ?? null },
  })

  const { error: updErr } = await admin
    .from('whatsapp_config')
    .update(patch)
    .eq('id', config.id)
  if (updErr) {
    console.error('[webhook] failed to sync whatsapp_config ids:', updErr)
    return
  }
  if (patch.phone_number_id) config.phone_number_id = patch.phone_number_id
  if (patch.waba_id) config.waba_id = patch.waba_id
}

/**
 * Older CRM rows were saved without waba_id. Inbound webhooks always carry
 * entry.id (WABA) + metadata.phone_number_id — bind the sole connected config
 * so replies start landing again without a manual Settings re-save.
 */
async function bindLegacyConnectedConfig(
  admin: SupabaseClient,
  phoneNumberId: string | undefined,
  wabaId: string | undefined,
): Promise<WhatsappConfigRow | null> {
  const { data, error } = await admin
    .from('whatsapp_config')
    .select('*')
    .is('waba_id', null)
    .eq('status', 'connected')

  if (error) {
    console.error('[webhook] legacy whatsapp_config lookup failed:', error)
    return null
  }
  if (!data || data.length === 0) return null
  if (data.length > 1) {
    console.error(
      `[webhook] ${data.length} connected configs missing waba_id — inbound dropped; set WABA in Settings for each account`,
    )
    return null
  }

  const config = data[0] as WhatsappConfigRow
  console.warn(
    '[webhook] binding legacy whatsapp_config (missing waba_id) from first inbound webhook',
    { config_id: config.id, account_id: config.account_id },
  )
  await syncInboundIdsFromMeta(admin, config, phoneNumberId, wabaId)
  return config
}
