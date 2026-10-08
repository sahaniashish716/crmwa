/** Shown when PostgREST reports migration 038 was not applied on Supabase. */
export const BROADCAST_TEMPLATE_PARAMS_MIGRATION_HINT =
  'Run Supabase migration 038 (adds broadcast_recipients.template_params). ' +
  'In the SQL editor: ALTER TABLE broadcast_recipients ADD COLUMN IF NOT EXISTS template_params JSONB; ' +
  'Then wait ~1 minute for the schema cache to refresh. See docs/supabase-migration-038-broadcast.md.';

export function isMissingBroadcastTemplateParamsColumn(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('template_params') &&
    (m.includes('schema cache') ||
      m.includes('does not exist') ||
      m.includes('could not find'))
  )
}

export function recipientParamsForSend(
  contactId: string | null | undefined,
  paramsByContact: Map<string, string[]>,
  rowParams: unknown,
): string[] {
  if (contactId) {
    const frozen = paramsByContact.get(contactId)
    if (frozen && frozen.length > 0) return frozen
  }
  return Array.isArray(rowParams)
    ? rowParams.filter((p): p is string => typeof p === 'string')
    : []
}
