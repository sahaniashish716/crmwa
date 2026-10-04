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
const STALE_RUNNING_MS = 30 * 60_000

/** Rows left `running` after a serverless timeout never resume without this. */
async function reclaimStaleRunningPending(admin: ReturnType<typeof supabaseAdmin>) {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS).toISOString()
  const { error } = await admin
    .from('automation_pending_executions')
    .update({ status: 'pending' })
    .eq('status', 'running')
    .lte('run_at', staleBefore)
  if (error) {
    console.error('[automations] cron drain: reclaim stale running failed:', error)
  }
}

async function fetchDuePending(limit: number, accountId?: string) {
  const admin = supabaseAdmin()
  let dueQuery = admin
    .from('automation_pending_executions')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', new Date().toISOString())
    .order('run_at', { ascending: true })
    .limit(limit)
  if (accountId) {
    dueQuery = dueQuery.eq('account_id', accountId)
  }
  return dueQuery
}

async function processPendingRows(
  due: Record<string, unknown>[] | null,
): Promise<number> {
  if (!due || due.length === 0) return 0
  const admin = supabaseAdmin()
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
  return processed
}

/** Resume due wait steps only (fast path for tag/inbound piggyback). */
export async function drainAutomationPendingWaits(
  limit = 100,
  accountId?: string,
): Promise<number> {
  await reclaimStaleRunningPending(supabaseAdmin())
  const { data: due, error } = await fetchDuePending(limit, accountId)
  if (error) {
    console.error('[automations] wait drain: pending fetch failed:', error)
    return 0
  }
  return processPendingRows((due ?? []) as Record<string, unknown>[])
}

export async function drainAutomationDueWork(
  limit = 100,
  /** When set, resume waits for this account first (tag/inbound piggyback). */
  accountId?: string,
): Promise<AutomationCronDrainResult> {
  const processed = await drainAutomationPendingWaits(limit, accountId)
  const scheduled = await runDueTimeBasedAutomations()
  return { processed, scheduled }
}

export function isAutomationCronConfigured(): boolean {
  return Boolean(process.env.AUTOMATION_CRON_SECRET?.trim())
}
