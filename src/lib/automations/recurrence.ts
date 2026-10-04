import type { Automation, TagTriggerConfig, WaitStepConfig } from '@/types'
import type { AutomationContext } from './engine'
import { supabaseAdmin } from './admin-client'
import { computeWaitRunAt, enqueueAutomationWait } from './wait-scheduler'

/** Pending row marker: cron should start a fresh automation run. */
export const RECURRENCE_TICK_VAR = '_automation_recurrence_tick'

export function tagRecurrenceInterval(automation: Automation): WaitStepConfig | null {
  if (automation.trigger_type !== 'tag_added') return null
  const cfg = automation.trigger_config as TagTriggerConfig
  const rec = cfg.recurrence
  if (!rec || rec.enabled === false) return null
  const amount = Number(rec.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = rec.unit
  if (!unit) return null
  return { amount, unit }
}

export function tagRecurrenceStopsOnInbound(automation: Automation): boolean {
  const cfg = automation.trigger_config as TagTriggerConfig
  return cfg.recurrence?.stop_on_inbound !== false
}

export function isRecurrenceTickContext(context: AutomationContext | undefined): boolean {
  return Boolean(context?.vars?.[RECURRENCE_TICK_VAR])
}

/** Queue another full run after a successful completion. */
export async function scheduleTagRecurrenceIfConfigured(
  automation: Automation,
  contactId: string | null | undefined,
  context: AutomationContext | undefined,
): Promise<void> {
  const interval = tagRecurrenceInterval(automation)
  if (!interval || !contactId) return

  const runAt = computeWaitRunAt(interval)
  const result = await enqueueAutomationWait({
    automationId: automation.id,
    accountId: automation.account_id,
    userId: automation.user_id,
    contactId,
    logId: null,
    parentStepId: null,
    branch: null,
    nextStepPosition: 0,
    context: {
      ...(context ?? {}),
      vars: {
        ...(context?.vars ?? {}),
        [RECURRENCE_TICK_VAR]: true,
      },
    },
    cfg: interval,
  })
  if ('error' in result) {
    console.error('[automations] recurrence schedule failed:', result.error)
  }
}

/** Stop repeat loops when the contact sends inbound (if configured). */
export async function cancelRecurrenceForContact(
  accountId: string,
  contactId: string,
): Promise<void> {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('automation_pending_executions')
    .select('id, context, automation_id')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .eq('status', 'pending')

  if (error) {
    console.error('[automations] recurrence cancel fetch failed:', error)
    return
  }

  const tickRows = (data ?? []).filter((row) =>
    Boolean((row.context as AutomationContext | null)?.vars?.[RECURRENCE_TICK_VAR]),
  )
  if (tickRows.length === 0) return

  const ids: string[] = []
  for (const row of tickRows) {
    const { data: automation } = await admin
      .from('automations')
      .select('trigger_type, trigger_config')
      .eq('id', row.automation_id as string)
      .maybeSingle()
    if (!automation || !tagRecurrenceStopsOnInbound(automation as Automation)) continue
    ids.push(row.id as string)
  }

  if (ids.length === 0) return

  const { error: delErr } = await admin.from('automation_pending_executions').delete().in('id', ids)
  if (delErr) {
    console.error('[automations] recurrence cancel delete failed:', delErr)
  }
}
