# Broadcast migration 038 (template_params)

If **Send Broadcast** fails with:

`Could not find the 'template_params' column of 'broadcast_recipients' in the schema cache`

your production Supabase project has not applied **migration 038** yet.

## Fix (Supabase SQL editor)

Run:

```sql
-- Per-recipient template body values ({{1}}, {{2}}, …), frozen at send plan time.
ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS template_params JSONB;

-- Optional but recommended for resume / server-side delivery (same migration file).
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS delivery_locked_at TIMESTAMPTZ;
```

Full function and RPC updates live in `supabase/migrations/038_broadcast_resume.sql` and `041_fix_broadcast_contact_id_ambiguity.sql`.

After running SQL, wait about **one minute** for PostgREST’s schema cache to refresh (or restart the API in Supabase dashboard if the error persists).

Then retry **Send Broadcast**.
