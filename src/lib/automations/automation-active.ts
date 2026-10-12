import { supabaseAdmin } from './admin-client'

export async function isAutomationActive(automationId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('automations')
    .select('is_active')
    .eq('id', automationId)
    .maybeSingle()
  if (error) {
    console.error('[automations] is_active lookup failed:', error)
    return false
  }
  return Boolean(data?.is_active)
}
