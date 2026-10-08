import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { runAutomationsForTrigger } from '@/lib/automations/engine'

interface Pair {
  contact_id: string
  tag_id: string
}

/**
 * After CSV import upserts contact_tags, fire tag_added automations
 * (import path bypasses addContactTagAndDispatch for bulk speed).
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireRole('agent')
    const body = (await request.json().catch(() => null)) as {
      pairs?: Pair[]
    } | null
    const pairs = Array.isArray(body?.pairs) ? body.pairs : []
    if (pairs.length === 0) {
      return NextResponse.json({ ok: true, dispatched: 0 })
    }

    let dispatched = 0
    for (const pair of pairs.slice(0, 500)) {
      const contactId = pair.contact_id?.trim()
      const tagId = pair.tag_id?.trim()
      if (!contactId || !tagId) continue

      const { data: contact } = await ctx.supabase
        .from('contacts')
        .select('id')
        .eq('id', contactId)
        .eq('account_id', ctx.accountId)
        .maybeSingle()
      if (!contact) continue

      await runAutomationsForTrigger({
        accountId: ctx.accountId,
        triggerType: 'tag_added',
        contactId,
        context: { tag_id: tagId },
      })
      dispatched++
    }

    return NextResponse.json({ ok: true, dispatched })
  } catch (err) {
    return toErrorResponse(err)
  }
}
