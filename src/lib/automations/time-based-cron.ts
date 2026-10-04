import type { Automation, TimeBasedTriggerConfig } from '@/types'
import { supabaseAdmin } from './admin-client'
import { runAutomationsForTrigger } from './engine'
import { isScheduleDue } from './schedule'

/** Fire every active time-based automation whose schedule matches now. */
export async function runDueTimeBasedAutomations(now: Date = new Date()): Promise<number> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('automations')
    .select('*')
    .eq('trigger_type', 'time_based')
    .eq('is_active', true)

  if (error) {
    console.error('[automations] time_based scan failed:', error)
    return 0
  }

  let fired = 0
  for (const row of (data ?? []) as Automation[]) {
    const cfg = row.trigger_config as TimeBasedTriggerConfig
    if (!cfg?.schedule) continue
    if (!isScheduleDue(cfg.schedule, cfg.timezone, row.last_executed_at ?? null, now)) {
      continue
    }
    const { data: claimed, error: claimErr } = await db.rpc('try_claim_automation_schedule', {
      p_automation_id: row.id,
    })
    if (claimErr) {
      // Migration 043 not applied yet — fall back to dispatch (dedupe via isScheduleDue only).
      const missing =
        claimErr.code === 'PGRST202' ||
        String(claimErr.message ?? '').includes('try_claim_automation_schedule')
      if (!missing) {
        console.error('[automations] time_based claim failed:', row.id, claimErr)
        continue
      }
    } else if (!claimed) {
      continue
    }

    try {
      await runAutomationsForTrigger({
        accountId: row.account_id,
        triggerType: 'time_based',
        automationId: row.id,
        contactId: undefined,
        context: {},
      })
      fired++
    } catch (err) {
      console.error('[automations] time_based dispatch failed:', err)
    }
  }
  return fired
}
