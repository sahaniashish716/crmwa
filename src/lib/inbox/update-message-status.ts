import type { SupabaseClient } from '@supabase/supabase-js'

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST204') return true
  const msg = error.message ?? ''
  return /column .* does not exist/i.test(msg) || /Could not find the .* column/i.test(msg)
}

/** Mirror Meta delivery status onto messages (0..N rows per wamid). */
export async function updateMessagesStatusByWamid(
  admin: SupabaseClient,
  wamid: string,
  status: string,
  failure: { code: number; title: string; details: string | null } | null,
): Promise<void> {
  const full: Record<string, unknown> = { status }
  if (failure) {
    full.error_code = failure.code
    full.error_title = failure.title
    full.error_details = failure.details
  }

  let { error } = await admin.from('messages').update(full).eq('message_id', wamid)

  if (error && isMissingColumnError(error) && failure) {
    ;({ error } = await admin
      .from('messages')
      .update({ status })
      .eq('message_id', wamid))
    if (!error) {
      console.warn(
        '[webhook] status updated without error_* columns — apply migration 042_message_failure_reason.sql',
      )
    }
  }

  if (error) {
    console.error('Error updating message status:', error)
  }
}
