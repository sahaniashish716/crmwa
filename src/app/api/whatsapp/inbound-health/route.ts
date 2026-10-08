import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/automations/admin-client'

/**
 * Agent-facing checklist: is the server configured to receive inbound
 * WhatsApp messages into Inbox?
 */
export async function GET(request: Request) {
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
    .select('phone_number_id, status, waba_id, updated_at')
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

  return NextResponse.json({
    ok:
      metaSecretConfigured &&
      serviceRoleConfigured &&
      encryptionConfigured &&
      waConfig?.status === 'connected' &&
      Boolean(waConfig?.phone_number_id),
    webhook_callback_url: `${origin}/api/whatsapp/webhook`,
    checks: {
      meta_app_secret_set: metaSecretConfigured,
      supabase_service_role_set: serviceRoleConfigured,
      encryption_key_set: encryptionConfigured,
      whatsapp_status_connected: waConfig?.status === 'connected',
      phone_number_id_set: Boolean(waConfig?.phone_number_id),
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
    hints: [
      !metaSecretConfigured &&
        'Set META_APP_SECRET on Vercel — without it webhook POST returns 401 and Meta stops sending inbound events.',
      waConfig?.status !== 'connected' &&
        'Connect WhatsApp in Settings; inbound routing uses phone_number_id from whatsapp_config.',
      !lastInbound &&
        'No customer messages in DB — usual causes: wrong META_APP_SECRET (401), messages webhook field not subscribed, or phone_number_id mismatch (now auto-synced from WABA when possible).',
    ].filter(Boolean),
  })
}
