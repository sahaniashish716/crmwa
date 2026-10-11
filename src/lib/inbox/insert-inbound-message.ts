import type { SupabaseClient } from '@supabase/supabase-js'

export type InboundMessageInsert = {
  conversation_id: string
  sender_type: 'customer'
  content_type: string
  content_text: string | null
  media_url: string | null
  media_type: string | null
  message_id: string
  status: 'delivered'
  created_at: string
  reply_to_message_id: string | null
  interactive_reply_id: string | null
}

type UpsertResult = { data: { id: string }[] | null; error: { code?: string; message?: string } | null }

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST204') return true
  const msg = error.message ?? ''
  return /column .* does not exist/i.test(msg) || /Could not find the .* column/i.test(msg)
}

/** Optional columns added after early deployments (009, 010, 039). */
const OPTIONAL_STRIPS: (keyof InboundMessageInsert)[] = [
  'media_type',
  'interactive_reply_id',
  'reply_to_message_id',
]

function stripOptional(
  row: InboundMessageInsert,
  depth: number,
): Record<string, unknown> {
  const keysToOmit = new Set(OPTIONAL_STRIPS.slice(0, depth))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (!keysToOmit.has(k as keyof InboundMessageInsert)) out[k] = v
  }
  return out
}

async function upsertInbound(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<UpsertResult> {
  const { data, error } = await admin
    .from('messages')
    .upsert(row, { onConflict: 'conversation_id,message_id', ignoreDuplicates: true })
    .select('id')
  return { data: data as { id: string }[] | null, error }
}

/**
 * Persist an inbound customer message. Retries with fewer columns when
 * Supabase/PostgREST reports PGRST204 (column missing — pending migration).
 */
export async function insertInboundCustomerMessage(
  admin: SupabaseClient,
  row: InboundMessageInsert,
): Promise<{ insertedIds: { id: string }[] | null; error: UpsertResult['error'] }> {
  let depth = 0
  let lastError: UpsertResult['error'] = null

  while (depth <= OPTIONAL_STRIPS.length) {
    const payload = depth === 0 ? row : stripOptional(row, depth)
    const { data, error } = await upsertInbound(admin, payload)
    if (!error) {
      if (depth > 0) {
        console.warn(
          '[webhook] inbound insert succeeded after omitting optional columns — run pending supabase/migrations (009, 010, 039, 037) on production',
          { omitted: OPTIONAL_STRIPS.slice(0, depth) },
        )
      }
      return { insertedIds: data, error: null }
    }
    lastError = error
    if (!isMissingColumnError(error)) {
      return { insertedIds: null, error }
    }
    depth++
  }

  return { insertedIds: null, error: lastError }
}
