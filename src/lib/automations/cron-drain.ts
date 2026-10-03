import type { AutomationContext } from './engine'
import { resumePendingExecution } from './engine'
import { runDueTimeBasedAutomations } from './time-based-cron'
import { supabaseAdmin } from './admin-client'

export interface AutomationCronDrainResult {
  /** Wait rows resumed this invocation. */
  processed: number
  /** time_based automations fired this invocation. */
  scheduled: number
}

/**
 * Resume due wait steps and fire due time-based automations.
 * Shared by GET /api/automations/cron, webhook piggyback, and post-dispatch hooks.
 */
export async function drainAutomationDueWork(
  limit = 50,
): Promise<AutomationCronDrainResult> {
  const admin = supabaseAdmin()
  const { data: due, error } = await admin
    .from('automation_pending_executions')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', new Date().toISOString())
    .order('run_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[automations] cron drain: pending fetch failed:', error)
    return { processed: 0, scheduled: await runDueTimeBasedAutomations() }
  }

  const scheduled = await runDueTimeBasedAutomations()

  if (!due || due.length === 0) {
    return { processed: 0, scheduled }
  }

  let processed = 0
  for (const row of due) {
    const { data: claim } = await admin
      .from('automation_pending_executions')
      .update({ status: 'running' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (!claim) continue

    await resumePendingExecution({
      id: row.id as string,
      automation_id: row.automation_id as string,
      account_id: row.account_id as string,
      user_id: row.user_id as string,
      contact_id: (row.contact_id as string | null) ?? null,
      log_id: (row.log_id as string | null) ?? null,
      parent_step_id: (row.parent_step_id as string | null) ?? null,
      branch: (row.branch as 'yes' | 'no' | null) ?? null,
      next_step_position: row.next_step_position as number,
      context: (row.context as AutomationContext) ?? {},
    })
    processed++
  }

  return { processed, scheduled }
}

export function isAutomationCronConfigured(): boolean {
  return Boolean(process.env.AUTOMATION_CRON_SECRET?.trim())
}
