import type { Automation, TagTriggerConfig } from '@/types'
import { supabaseAdmin } from './admin-client'
import { dispatchAutomationRun } from './engine'
import { loadStepsTree } from './steps-tree'
import {
  normalizeTagTriggerConfig,
  tagRecurrenceInterval,
  waitIntervalFromSteps,
} from './tag-recurrence-config'
import { enqueueRecurrenceAt } from './recurrence'
import { computeWaitRunAt, enqueueAutomationWait } from './wait-scheduler'

/** Next scheduled instant on the recurrence grid anchored at `anchor`. */
export function computeNextScheduledRunAt(
  anchor: Date,
  interval: { amount: number; unit: string },
  now: Date = new Date(),
): { runAt: Date; isOverdue: boolean } {
  let first = new Date(computeWaitRunAt(interval as import('@/types').WaitStepConfig, anchor))
  if (first <= now) {
    return { runAt: now, isOverdue: true }
  }
  return { runAt: first, isOverdue: false }
}

async function contactHasActivePending(
  automationId: string,
  contactId: string,
): Promise<boolean> {
  const { count, error } = await supabaseAdmin()
    .from('automation_pending_executions')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', automationId)
    .eq('contact_id', contactId)
    .in('status', ['pending', 'running', 'awaiting_reply'])

  if (error) {
    console.error('[automations] bootstrap pending check failed:', error)
    return true
  }
  return (count ?? 0) > 0
}

/**
 * When a tag-based automation is turned back on, re-enroll contacts who
 * already carry the trigger tag — without removing/re-adding the tag.
 * Timing follows the original anchor (last successful run, or when the
 * tag was applied).
 */
export async function bootstrapTagAutomationOnActivate(
  automation: Automation,
): Promise<void> {
  if (automation.trigger_type !== 'tag_added' || !automation.is_active) return

  const cfg = normalizeTagTriggerConfig(
    automation.trigger_config as TagTriggerConfig,
  )
  const tagId = cfg.tag_id?.trim()
  if (!tagId) return

  const recurrence = tagRecurrenceInterval(automation)
  const steps = await loadStepsTree(automation.id)
  const firstWait = waitIntervalFromSteps(
    steps.map((s) => ({
      step_type: s.step_type,
      step_config: s.step_config as Record<string, unknown>,
    })),
  )
  const interval = recurrence ?? firstWait
  if (!interval) {
    // One-shot tag automations only fire on tag add events — nothing to bootstrap.
    return
  }

  const admin = supabaseAdmin()

  const { data: tagLinks, error: tagErr } = await admin
    .from('contact_tags')
    .select('contact_id, created_at, contacts!inner(account_id)')
    .eq('tag_id', tagId)
    .eq('contacts.account_id', automation.account_id)

  if (tagErr) {
    console.error('[automations] bootstrap tag contacts failed:', tagErr)
    return
  }

  for (const row of tagLinks ?? []) {
    const contactId = row.contact_id as string
    const tagAppliedAt = new Date(String(row.created_at ?? new Date().toISOString()))

    if (await contactHasActivePending(automation.id, contactId)) continue

    const { data: lastSuccess } = await admin
      .from('automation_logs')
      .select('created_at')
      .eq('automation_id', automation.id)
      .eq('contact_id', contactId)
      .in('status', ['success', 'partial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const anchor = lastSuccess?.created_at
      ? new Date(String(lastSuccess.created_at))
      : tagAppliedAt

    const { runAt, isOverdue } = computeNextScheduledRunAt(anchor, interval)

    const context = { tag_id: tagId, vars: {} as Record<string, unknown> }

    if (isOverdue) {
      await dispatchAutomationRun(automation, {
        contactId,
        context,
        skipPendingCancel: true,
      }).catch((err) =>
        console.error('[automations] bootstrap immediate run failed:', err),
      )
      continue
    }

    const runAtIso = runAt.toISOString()

    if (recurrence) {
      const result = await enqueueRecurrenceAt(
        automation,
        contactId,
        context,
        runAtIso,
      )
      if ('error' in result) {
        console.error('[automations] bootstrap recurrence enqueue failed:', result.error)
      }
      continue
    }

    const waitStep = steps.find((s) => s.step_type === 'wait')
    if (!waitStep || !firstWait) continue

    const result = await enqueueAutomationWait({
      automationId: automation.id,
      accountId: automation.account_id,
      userId: automation.user_id,
      contactId,
      logId: null,
      parentStepId: null,
      branch: null,
      nextStepPosition: waitStep.position + 1,
      context,
      cfg: firstWait,
      runAtOverride: runAtIso,
    })
    if ('error' in result) {
      console.error('[automations] bootstrap wait enqueue failed:', result.error)
    }
  }
}
