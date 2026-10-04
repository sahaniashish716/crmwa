import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addWeeks,
} from 'date-fns'
import type { WaitStepConfig } from '@/types'
import type { AutomationContext } from './engine'
import { supabaseAdmin } from './admin-client'

export type WaitUnit = WaitStepConfig['unit']

/** Compute when a wait step should resume (ISO UTC). Uses calendar math for long delays. */
export function computeWaitRunAt(
  cfg: WaitStepConfig,
  from: Date = new Date(),
): string {
  const amount = Math.max(1, Math.floor(Number(cfg.amount) || 1))
  let at: Date
  switch (cfg.unit) {
    case 'minutes':
      at = addMinutes(from, amount)
      break
    case 'hours':
      at = addHours(from, amount)
      break
    case 'days':
      at = addDays(from, amount)
      break
    case 'weeks':
      at = addWeeks(from, amount)
      break
    case 'months':
      at = addMonths(from, amount)
      break
    default:
      at = addHours(from, amount)
  }
  return at.toISOString()
}

export function formatWaitDetail(cfg: WaitStepConfig): string {
  const amount = Math.max(1, Math.floor(Number(cfg.amount) || 1))
  return `waiting ${amount} ${cfg.unit}; until ${computeWaitRunAt(cfg)}`
}

/**
 * Drop older pending waits for the same automation + contact so re-tagging
 * does not deliver multiple delayed messages from past runs.
 */
export async function cancelPendingWaitsForContact(
  automationId: string,
  contactId: string | null | undefined,
): Promise<void> {
  if (!contactId) return
  const admin = supabaseAdmin()
  const { error } = await admin
    .from('automation_pending_executions')
    .delete()
    .eq('automation_id', automationId)
    .eq('contact_id', contactId)
    .eq('status', 'pending')
  if (error) {
    console.error('[automations] cancel pending waits failed:', error)
  }
}

export interface EnqueueWaitInput {
  automationId: string
  accountId: string
  userId: string
  contactId: string | null
  logId: string | null
  parentStepId: string | null
  branch: 'yes' | 'no' | null
  nextStepPosition: number
  context: AutomationContext
  cfg: WaitStepConfig
}

/** Persist a wait step; returns run_at ISO on success. */
export async function enqueueAutomationWait(
  input: EnqueueWaitInput,
): Promise<{ runAt: string } | { error: string }> {
  const runAt = computeWaitRunAt(input.cfg)
  const admin = supabaseAdmin()
  const { error } = await admin.from('automation_pending_executions').insert({
    automation_id: input.automationId,
    account_id: input.accountId,
    user_id: input.userId,
    contact_id: input.contactId,
    log_id: input.logId,
    parent_step_id: input.parentStepId,
    branch: input.branch,
    next_step_position: input.nextStepPosition,
    context: input.context,
    run_at: runAt,
    status: 'pending',
  })
  if (error) {
    console.error('[automations] wait enqueue failed:', error)
    return { error: error.message }
  }
  return { runAt }
}
