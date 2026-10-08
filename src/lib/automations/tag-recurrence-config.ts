import type {
  Automation,
  TagRecurrenceConfig,
  TagTriggerConfig,
  WaitStepConfig,
} from '@/types'

export const TAG_RECURRENCE_UNITS = [
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
] as const

export type TagRecurrenceUnit = (typeof TAG_RECURRENCE_UNITS)[number]

function parseUnit(raw: unknown): TagRecurrenceUnit | null {
  const unit = String(raw ?? '').trim() as TagRecurrenceUnit
  return TAG_RECURRENCE_UNITS.includes(unit) ? unit : null
}

function parseAmount(raw: unknown): number | null {
  const amount = Math.floor(Number(raw))
  if (!Number.isFinite(amount) || amount <= 0) return null
  return amount
}

/** Normalize tag trigger recurrence from API / DB JSON. */
export function normalizeTagRecurrence(
  rec: TagRecurrenceConfig | Record<string, unknown> | undefined | null,
): TagRecurrenceConfig | undefined {
  if (!rec || typeof rec !== 'object') return undefined
  const enabled = rec.enabled === true
  if (!enabled) {
    return rec.enabled === false ? { ...rec, enabled: false } as TagRecurrenceConfig : undefined
  }
  const amount = parseAmount(rec.amount)
  const unit = parseUnit(rec.unit)
  if (amount == null || unit == null) return undefined
  return {
    enabled: true,
    amount,
    unit,
    stop_on_inbound: rec.stop_on_inbound !== false,
  }
}

export function normalizeTagTriggerConfig(
  triggerConfig: TagTriggerConfig | Record<string, unknown>,
): TagTriggerConfig {
  const cfg = { ...(triggerConfig as TagTriggerConfig) }
  const normalized = normalizeTagRecurrence(cfg.recurrence)
  if (normalized) {
    cfg.recurrence = normalized
  } else {
    delete cfg.recurrence
  }
  return cfg
}

/** First root-level wait step interval (builder / API step tree roots). */
export function waitIntervalFromSteps(
  steps: { step_type: string; step_config: Record<string, unknown> }[],
): WaitStepConfig | null {
  const first = steps.find((s) => s.step_type === 'wait')
  if (!first) return null
  const amount = parseAmount(first.step_config.amount)
  const unit = parseUnit(first.step_config.unit)
  if (amount == null || unit == null) return null
  return { amount, unit }
}

/**
 * When recurrence is on and a root Wait step exists, use the same amount/unit
 * so repeat timing matches the wait the user configured (minutes–months).
 */
export function mergeTagRecurrenceWithFirstWait(
  triggerConfig: TagTriggerConfig | Record<string, unknown>,
  steps: { step_type: string; step_config: Record<string, unknown> }[],
): TagTriggerConfig {
  const cfg = normalizeTagTriggerConfig(triggerConfig)
  if (cfg.recurrence?.enabled !== true) return cfg
  const fromWait = waitIntervalFromSteps(steps)
  if (!fromWait) return cfg
  return {
    ...cfg,
    recurrence: {
      ...cfg.recurrence,
      enabled: true,
      amount: fromWait.amount,
      unit: fromWait.unit,
    },
  }
}

export function tagRecurrenceInterval(automation: Automation): WaitStepConfig | null {
  if (automation.trigger_type !== 'tag_added') return null
  const cfg = normalizeTagTriggerConfig(automation.trigger_config as TagTriggerConfig)
  const rec = cfg.recurrence
  if (!rec || rec.enabled !== true) return null
  return { amount: rec.amount, unit: rec.unit }
}

export function tagRecurrenceStopsOnInbound(automation: Automation): boolean {
  const cfg = normalizeTagTriggerConfig(automation.trigger_config as TagTriggerConfig)
  return cfg.recurrence?.stop_on_inbound !== false
}

export function prepareTagTriggerConfigForSave(
  triggerType: string,
  triggerConfig: Record<string, unknown> | undefined,
  steps: { step_type: string; step_config: Record<string, unknown> }[] | undefined,
): TagTriggerConfig | Record<string, unknown> {
  if (triggerType !== 'tag_added') return triggerConfig ?? {}
  return mergeTagRecurrenceWithFirstWait(triggerConfig ?? {}, steps ?? [])
}
