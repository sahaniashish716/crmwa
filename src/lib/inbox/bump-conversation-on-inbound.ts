import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * After a new customer message is inserted, refresh the conversation row
 * so the Inbox list sorts by recency. Prefer migration 037's RPC; fall back
 * to a direct UPDATE when the function was never applied on the project.
 */
export async function bumpConversationOnInbound(
  admin: SupabaseClient,
  conversationId: string,
  lastMessageText: string,
): Promise<void> {
  const preview = lastMessageText.trim() || '[message]'

  const { error: rpcError } = await admin.rpc('bump_conversation_on_inbound', {
    p_conversation_id: conversationId,
    p_last_message_text: preview,
  })

  if (!rpcError) return

  console.error(
    '[webhook] bump_conversation_on_inbound RPC failed — using fallback UPDATE (apply migration 037 on Supabase):',
    rpcError.message,
  )

  const { data: row, error: readErr } = await admin
    .from('conversations')
    .select('unread_count')
    .eq('id', conversationId)
    .maybeSingle()

  if (readErr) {
    console.error('[webhook] conversation read before fallback bump failed:', readErr)
    return
  }

  const { error: updErr } = await admin
    .from('conversations')
    .update({
      unread_count: (row?.unread_count ?? 0) + 1,
      last_message_text: preview,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  if (updErr) {
    console.error('[webhook] conversation fallback bump failed:', updErr)
  }
}
