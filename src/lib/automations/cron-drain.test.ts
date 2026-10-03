import { describe, it, expect } from 'vitest'
import { isAutomationCronConfigured } from './cron-drain'

describe('isAutomationCronConfigured', () => {
  it('is false when env unset', () => {
    const prev = process.env.AUTOMATION_CRON_SECRET
    delete process.env.AUTOMATION_CRON_SECRET
    expect(isAutomationCronConfigured()).toBe(false)
    if (prev) process.env.AUTOMATION_CRON_SECRET = prev
  })
})
