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
