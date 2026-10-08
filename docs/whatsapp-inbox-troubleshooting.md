# WhatsApp outreach not received / inbox empty after reply

Two separate problems are often mixed together:

1. **Your phone did not get the template/broadcast** → Meta **outbound** delivery (see `docs/whatsapp-delivery-errors.md`).
2. **You replied on WhatsApp but nothing appears in Inbox** → **inbound webhook** or **wrong conversation** in the UI.

## Checklist: message not on your phone (outreach)

- In **Settings → WhatsApp**, status must be **Connected** and `phone_number_id` must match the Meta app that sends messages.
- Broadcast/automation logs: if status is **Failed** with **131049** / **131026**, Meta rejected delivery — retry will not help immediately.
- Use a **real customer number** in E.164 (`+91…`). You cannot reliably “WhatsApp yourself” from the same business number.
- Template must be **approved** in Meta; marketing templates need opt-in and limits apply.

## Checklist: reply not in Inbox

### 1. Meta must call your webhook

In [Meta Developer Console](https://developers.facebook.com/) → your app → WhatsApp → Configuration:

- **Callback URL**: `https://<your-production-domain>/api/whatsapp/webhook`
- **Verify token**: same value stored in your CRM WhatsApp settings (encrypted in DB).
- Subscribe to **messages** (and **message_echoes** if you use them).

Test: Meta “Send test webhook” or send a real message; your server must return **200** quickly.

### 2. Environment on Vercel (production)

- `META_APP_SECRET` — if wrong/missing, webhook returns **401** and Meta stops delivering.
- `SUPABASE_SERVICE_ROLE_KEY` — webhook inserts use admin client.
- `WHATSAPP_TOKEN_ENCRYPTION_KEY` — must match the key used when saving tokens.

### 3. Database migrations

Inbound path needs at least:

- `bump_conversation_on_inbound` (migration **037**)
- Unique `(conversation_id, message_id)` on messages (037)

Run pending SQL from `supabase/migrations/` on your Supabase project if inbound never worked.

### 4. In the Inbox UI

- Open **Inbox** and look for the contact by **phone** — replies attach to the **oldest** conversation for that contact. Duplicate contacts = duplicate threads; the new reply may be on another row.
- Click **Refresh** on the thread header or wait ~20s (poll fallback).
- Ensure your user **profile `account_id`** matches the WhatsApp config account (teammates see the shared inbox only when linked to that account).

### 5. Confirm in Supabase

After you send a test reply from your phone:

```sql
SELECT id, content_text, created_at, conversation_id
FROM messages
WHERE sender_type = 'customer'
ORDER BY created_at DESC
LIMIT 5;
```

- **No row** → webhook never persisted (steps 1–3).
- **Row exists** → UI/RLS/wrong conversation (step 4).
