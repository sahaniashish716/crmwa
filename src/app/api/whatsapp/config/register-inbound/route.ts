import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  registerPhoneNumber,
  subscribeWabaToApp,
} from '@/lib/whatsapp/meta-api'
import {
  explainMetaError,
  metaErrorPayload,
  type MetaErrorContext,
} from '@/lib/whatsapp/meta-error-explain'

/**
 * POST /api/whatsapp/config/register-inbound
 *
 * Production WhatsApp numbers must call Meta's /register with the
 * two-step verification PIN or Meta will not route inbound message
 * webhooks to this app (`registered_at` stays null).
 */
export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('admin')

    let body: { pin?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const pin = body.pin?.trim()
    if (!pin) {
      return NextResponse.json(
        {
          error:
            'Two-step verification PIN is required. Set it in Meta Business Manager → WhatsApp → Phone numbers → Two-step verification.',
        },
        { status: 400 },
      )
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: config, error: loadErr } = await admin
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (loadErr || !config) {
      return NextResponse.json(
        { error: 'No WhatsApp configuration found for this account.' },
        { status: 404 },
      )
    }

    if (!config.waba_id || !config.phone_number_id) {
      return NextResponse.json(
        { error: 'WABA ID and Phone Number ID must be saved before registration.' },
        { status: 400 },
      )
    }

    let accessToken: string
    try {
      accessToken = decrypt(String(config.access_token))
    } catch {
      return NextResponse.json(
        {
          error:
            'Stored access token cannot be decrypted. Re-enter the token under Settings → WhatsApp and save, then retry.',
        },
        { status: 400 },
      )
    }

    const metaCtx: MetaErrorContext = {
      phoneNumberId: config.phone_number_id,
      wabaId: config.waba_id,
    }

    let alreadyRegistered = false
    try {
      const result = await registerPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
        pin,
      })
      alreadyRegistered = result.alreadyRegistered
    } catch (err) {
      const explained = explainMetaError(err, 'register', metaCtx)
      const { error: persistErr } = await admin
        .from('whatsapp_config')
        .update({
          last_registration_error: explained.summary,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', accountId)
      if (persistErr) {
        console.error('[register-inbound] failed to persist error:', persistErr)
      }
      return NextResponse.json(
        {
          success: false,
          error: explained.summary,
          meta: metaErrorPayload(explained),
        },
        { status: 422 },
      )
    }

    try {
      await subscribeWabaToApp({
        wabaId: config.waba_id,
        accessToken,
      })
    } catch (err) {
      const explained = explainMetaError(err, 'subscribe_waba', metaCtx)
      return NextResponse.json(
        {
          success: false,
          registered: false,
          error: explained.summary,
          meta: metaErrorPayload(explained),
        },
        { status: 422 },
      )
    }

    const now = new Date().toISOString()
    const { error: updErr } = await admin
      .from('whatsapp_config')
      .update({
        registered_at: now,
        subscribed_apps_at: now,
        last_registration_error: null,
        status: 'connected',
        connected_at: config.connected_at ?? now,
        updated_at: now,
      })
      .eq('account_id', accountId)

    if (updErr) {
      console.error('[register-inbound] update failed:', updErr)
      return NextResponse.json(
        { error: 'Registered with Meta but failed to update CRM config.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      registered: true,
      already_registered: alreadyRegistered,
      registered_at: now,
      message:
        'Inbound registration complete. Send a test reply from a customer phone — it should appear in Inbox within seconds.',
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
