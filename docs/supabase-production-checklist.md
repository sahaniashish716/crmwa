# Supabase production checklist

Run migrations **001 → 047** in order on every environment that serves production traffic. Skipping files causes silent failures (webhook POST 200 but no Inbox row, broadcast API 500, etc.).

## Quick verify (SQL editor)

```sql
-- Inbound message columns (fixes Vercel PGRST204 on insert)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'messages'
  AND column_name IN ('media_type', 'interactive_reply_id', 'reply_to_message_id', 'error_code');

-- Webhook idempotency
SELECT indexname FROM pg_indexes
WHERE tablename = 'messages' AND indexname = 'idx_messages_conversation_message_id';

-- Broadcast RPC (needs 038 + 041)
SELECT pronargs FROM pg_proc
WHERE proname = 'create_broadcast_with_recipients';
-- expect 8 arguments after 038/041

-- Inbox bump RPC
SELECT proname FROM pg_proc WHERE proname = 'bump_conversation_on_inbound';
```

## Critical migrations by feature

| Feature | Migrations |
|---------|------------|
| Inbound WhatsApp | **009**, **010**, **037**, **039**, **040** (BSUID), **042** (failed status) |
| Inbox list updates | **037** (`bump_conversation_on_inbound`) |
| Broadcasts + resume | **037**, **038**, **041** |
| Automations cron | **043** (optional; app has fallback) |
| AI auto-reply | **029–033**, **031** (grant) |
| Team presence | **024**, **046** (grant) |
| Public API webhooks | **028**, **046** (`record_webhook_failure` grant) |
| Template submit (team) | **047** |

## One-shot repair (partial schema)

If inbound worked on Meta but Vercel logged `PGRST204`, run **`docs/supabase-inbound-repair.sql`**, then apply any remaining files from `supabase/migrations/` that you have not run yet (especially **037**, **041**, **042**, **046**, **047**).

After any DDL change:

```sql
NOTIFY pgrst, 'reload schema';
```
