import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { drainAutomationDueWork } from '@/lib/automations/cron-drain'

/**
 * Drain due `automation_pending_executions` rows and fire due time_based
 * automations. Hit on a schedule (GitHub Actions, cron-job.org, Vercel Cron
 * on Pro) with header `x-cron-secret` matching `AUTOMATION_CRON_SECRET`.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  if (!verifyCronSecret(request, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { processed, scheduled } = await drainAutomationDueWork(200)
  return NextResponse.json({ processed, scheduled })
}

/** Some external schedulers default to POST. */
export async function POST(request: Request) {
  return GET(request)
}
