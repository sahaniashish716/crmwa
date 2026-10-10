import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/automations/admin-client'

/**
 * Agent-facing checklist: is the server configured to receive inbound
 * WhatsApp messages into Inbox?
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const probePhone = url.searchParams.get('phone')?.trim() ?? ''
  let accountId: string
  try {
    const ctx = await getCurrentAccount()
    accountId = ctx.accountId
  } catch (err) {
    return toErrorResponse(err)
  }

  const origin = new URL(request.url).origin
  const admin = supabaseAdmin()

  const { data: waConfig } = await admin
    .from('whatsapp_config')
    .select(
      'phone_number_id, status, waba_id, registered_at, subscribed_apps_at, updated_at',
    )
    .eq('account_id', accountId)
    .maybeSingle()

  const { data: lastInbound } = await admin
    .from('messages')
    .select(
      'id, created_at, conversation_id, content_text, conversations!inner(account_id)',
    )
    .eq('sender_type', 'customer')
    .eq('conversations.account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const metaSecretConfigured = Boolean(process.env.META_APP_SECRET?.trim())
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  const encryptionConfigured = Boolean(process.env.ENCRYPTION_KEY?.trim())

  let phoneProbe: Record<string, unknown> | null = null
  if (probePhone) {
    const suffix =
      probePhone.replace(/\D/g, '').slice(-8) || probePhone.replace(/\D/g, '')
    const { data: contacts } = await admin
      .from('contacts')
      .select('id, phone, name')
      .eq('account_id', accountId)
      .like('phone', `%${suffix}`)
      .limit(20)

    const matched = (contacts ?? []).filter((c) => {
      const p = String(c.phone ?? '')
      const digits = (s: string) => s.replace(/\D/g, '')
      const a = digits(p)
      const b = digits(probePhone)
      return a === b || (a.length >= 8 && b.length >= 8 && a.slice(-8) === b.slice(-8))
    })

    const contactIds = matched.map((c) => c.id as string)
    let customerMessages: unknown[] = []
    if (contactIds.length > 0) {
      const { data: convs } = await admin
        .from('conversations')
        .select('id, last_message_at, last_message_text')
        .eq('account_id', accountId)
        .in('contact_id', contactIds)

      const convIds = (convs ?? []).map((c) => c.id as string)
      if (convIds.length > 0) {
        const { data: msgs } = await admin
          .from('messages')
          .select(
            'id, content_text, sender_type, created_at, conversation_id',
          )
          .in('conversation_id', convIds)
          .eq('sender_type', 'customer')
          .order('created_at', { ascending: false })
          .limit(5)
        customerMessages = msgs ?? []
      }

      phoneProbe = {
        phone: probePhone,
        contacts: matched,
        conversations: convs ?? [],
        recent_customer_messages: customerMessages,
      }
    } else {
      phoneProbe = {
        phone: probePhone,
        contacts: [],
        hint: 'No contact row matches this phone in your account — inbound will create one on first webhook.',
      }
    }
  }

  return NextResponse.json({
    ok:
      metaSecretConfigured &&
      serviceRoleConfigured &&
      encryptionConfigured &&
      waConfig?.status === 'connected' &&
      Boolean(waConfig?.phone_number_id) &&
      Boolean(waConfig?.waba_id) &&
      Boolean(waConfig?.registered_at),
    webhook_callback_url: `${origin}/api/whatsapp/webhook`,
    checks: {
      meta_app_secret_set: metaSecretConfigured,
      supabase_service_role_set: serviceRoleConfigured,
      encryption_key_set: encryptionConfigured,
      whatsapp_status_connected: waConfig?.status === 'connected',
      phone_number_id_set: Boolean(waConfig?.phone_number_id),
      waba_id_set: Boolean(waConfig?.waba_id),
      locally_registered: Boolean(waConfig?.registered_at),
      waba_subscribed_at: Boolean(waConfig?.subscribed_apps_at),
    },
    whatsapp: waConfig ?? null,
    last_customer_message: lastInbound
      ? {
          at: lastInbound.created_at,
          preview: (lastInbound.content_text as string | null)?.slice(0, 120) ?? null,
          conversation_id: lastInbound.conversation_id,
        }
      : null,
    meta_webhook_checklist: [
      'Callback URL must be https://<your-domain>/api/whatsapp/webhook',
      'Subscribe to the messages field (not statuses alone)',
      'Verify token must match Settings → WhatsApp',
      'META_APP_SECRET on Vercel must match the Meta app that owns this WABA',
      `Stored phone_number_id: ${waConfig?.phone_number_id ?? '(none)'} — must match Meta webhook metadata`,
    ],
    phone_probe: phoneProbe,
    hints: [
      !metaSecretConfigured &&
        'Set META_APP_SECRET on Vercel — without it webhook POST returns 401 and Meta stops sending inbound events.',
      waConfig?.status !== 'connected' &&
        'Connect WhatsApp in Settings; inbound routing uses phone_number_id from whatsapp_config.',
      !waConfig?.waba_id &&
        'WABA ID missing on whatsapp_config — inbound routing cannot match Meta webhooks until you re-save Settings → WhatsApp with WABA ID (or deploy the legacy auto-bind fix).',
      !waConfig?.registered_at &&
        'registered_at is empty — Meta is NOT routing inbound messages to this CRM. Settings → WhatsApp: enter your two-step verification PIN and use “Register inbound”, or Save Configuration with PIN filled in.',
      !waConfig?.subscribed_apps_at &&
        'subscribed_apps_at is empty — WABA may not be subscribed to this Meta app; re-save WhatsApp settings or use Register inbound.',
      !lastInbound &&
        'No customer messages in DB — usual causes: wrong META_APP_SECRET (401), messages webhook field not subscribed, or phone_number_id / waba_id mismatch (auto-synced from webhooks when possible).',
    ].filter(Boolean),
  })
}
