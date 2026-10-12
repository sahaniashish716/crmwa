import { supabaseAdmin } from './admin-client'

const CANCELLABLE = ['pending', 'running'] as const

/**
 * Stop queued work for an automation (waits, recurrence ticks, in-flight
 * claims). Called when the user deactivates or deletes an automation.
 */
export async function cancelPendingRunsForAutomation(
  automationId: string,
): Promise<number> {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('automation_pending_executions')
    .update({ status: 'failed' })
    .eq('automation_id', automationId)
    .in('status', [...CANCELLABLE])
    .select('id')

  if (error) {
    console.error('[automations] cancel pending runs failed:', error)
    return 0
  }

  let cancelled = data?.length ?? 0

  // Migration 045 — reply waits are not in the cron drain but still send
  // when inbound resumes them.
  const { data: awaiting, error: awaitingErr } = await admin
    .from('automation_pending_executions')
    .update({ status: 'superseded' })
    .eq('automation_id', automationId)
    .eq('status', 'awaiting_reply')
    .select('id')

  if (awaitingErr) {
    const msg = (awaitingErr.message ?? '').toLowerCase()
    if (!msg.includes('superseded') && !msg.includes('check constraint')) {
      console.error('[automations] cancel awaiting_reply runs failed:', awaitingErr)
    }
  } else {
    cancelled += awaiting?.length ?? 0
  }

  return cancelled
}

/**
 * Pending rows for paused automations must never resume (cron / inbound drain).
 * Marks them failed so they stop resurfacing via stale-running reclaim.
 */
export async function failPendingForInactiveAutomations(
  accountId?: string,
): Promise<number> {
  const admin = supabaseAdmin()
  let query = admin
    .from('automation_pending_executions')
    .select('id, automation_id, automations!inner(is_active)')
    .in('status', ['pending', 'running'])

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query
  if (error) {
    console.error('[automations] fail inactive pending fetch failed:', error)
    return 0
  }

  const ids = (data ?? [])
    .filter((row) => {
      const joined = row.automations as { is_active?: boolean } | { is_active?: boolean }[]
      const active = Array.isArray(joined) ? joined[0]?.is_active : joined?.is_active
      return active === false
    })
    .map((row) => row.id as string)

  if (ids.length === 0) return 0

  const { error: updErr } = await admin
    .from('automation_pending_executions')
    .update({ status: 'failed' })
    .in('id', ids)

  if (updErr) {
    console.error('[automations] fail inactive pending update failed:', updErr)
    return 0
  }
  return ids.length
}
