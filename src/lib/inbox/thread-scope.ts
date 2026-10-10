import type { SupabaseClient } from '@supabase/supabase-js'
import { phonesMatch, normalizePhone } from '@/lib/whatsapp/phone-utils'
import type { Contact, Conversation, Message } from '@/types'

/**
 * Inbound webhooks attach to the oldest conversation for a contact; outbound
 * sends use whichever thread the agent opened. Without migration 036, duplicate
 * conversation rows split the thread — this collects every conversation id
 * that should appear in one Inbox thread for the same person.
 */
export async function resolveThreadConversationIds(
  supabase: SupabaseClient,
  conversation: Pick<Conversation, 'id' | 'contact_id'>,
  contact: Contact | null | undefined,
): Promise<string[]> {
  const ids = new Set<string>([conversation.id])
  const contactIds = new Set<string>([conversation.contact_id])

  if (contact?.phone?.trim()) {
    const phone = contact.phone.trim()
    const normalized = normalizePhone(phone)
    const suffix =
      normalized.length >= 8 ? normalized.slice(-8) : normalized

    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, phone')
      .like('phone', `%${suffix}`)

    if (!error) {
      for (const row of contacts ?? []) {
        if (phonesMatch(String(row.phone ?? ''), phone)) {
          contactIds.add(row.id as string)
        }
      }
    }
  }

  const { data: convs, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .in('contact_id', [...contactIds])

  if (!convErr) {
    for (const row of convs ?? []) ids.add(row.id as string)
  }

  return [...ids]
}

export async function fetchThreadMessages(
  supabase: SupabaseClient,
  conversation: Pick<Conversation, 'id' | 'contact_id'>,
  contact: Contact | null | undefined,
): Promise<{ data: Message[] | null; error: Error | null }> {
  const conversationIds = await resolveThreadConversationIds(
    supabase,
    conversation,
    contact,
  )

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: (data as Message[]) ?? [], error: null }
}

/** One row per contact in the list — keep the conversation with latest activity. */
export function dedupeConversationsByContact(
  conversations: Conversation[],
): Conversation[] {
  const byContact = new Map<string, Conversation>()

  for (const c of conversations) {
    const key = c.contact_id || c.id
    const prev = byContact.get(key)
    if (!prev) {
      byContact.set(key, c)
      continue
    }
    const prevAt = prev.last_message_at
      ? new Date(prev.last_message_at).getTime()
      : 0
    const curAt = c.last_message_at
      ? new Date(c.last_message_at).getTime()
      : 0
    if (curAt >= prevAt) byContact.set(key, c)
  }

  return [...byContact.values()].sort((a, b) => {
    const aT = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const bT = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    return bT - aT
  })
}
