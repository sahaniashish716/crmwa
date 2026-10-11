-- Run in Supabase SQL Editor when Vercel logs show:
--   Error inserting message: { code: 'PGRST204', ...
-- Meta webhooks arrive (POST 200) but messages are not saved.
--
-- Safe to re-run (IF NOT EXISTS / idempotent pieces from migrations 009–010, 037, 039).

-- 009 — swipe-reply context
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID
  REFERENCES messages(id) ON DELETE SET NULL;

-- 010 — interactive taps + content_type
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_type_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive'
  ));
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS interactive_reply_id TEXT;

-- 039 — inbound attachment MIME
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_type TEXT;

-- 037 — idempotent webhook inserts (requires no duplicate pairs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conversation_message_id
  ON messages (conversation_id, message_id);

-- 037 — conversation list bump (see full file for function body if missing)
-- If bump_conversation_on_inbound is missing, run entire:
--   supabase/migrations/037_webhook_broadcast_reliability.sql

NOTIFY pgrst, 'reload schema';
