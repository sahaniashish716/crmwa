# CRM modules — how they connect (audit)

This document describes how **Dashboard**, **Inbox**, **Contacts**, **Pipelines**, **Broadcasts**, **Automations**, and **Flows** work together in **crmwa**, what was verified in code/tests, and what you must configure in production (especially **inbound WhatsApp → Inbox**).

## Shared foundation

| Piece | Role |
|--------|------|
| **Account (`account_id`)** | Every module is scoped to one business account (multi-user). |
| **Contact** | Central identity (phone / WhatsApp ID). Created by webhook, import, broadcast audience, or manual form. |
| **Conversation** | One thread per `(account, contact)` — **Inbox** reads this. |
| **Messages** | Inbound (customer) and outbound (agent, bot, automation, flow). |
| **Tags** | Link **Contacts**, **Broadcast** audience, **Automations** (`tag_added`), **Flows** (`set_tag`). |

**Hub:** Meta webhook `POST /api/whatsapp/webhook` creates/updates contacts, conversations, messages, broadcast status, runs **Flows** then **Automations**, then optional AI reply.

---

## Module-by-module

### Dashboard (`/dashboard`)

- **Reads only:** conversations, contacts, messages, deals, broadcasts, automation_logs.
- **Does not send** WhatsApp or start automations.
- **Related to:** everything above as metrics/activity feed.

### Contacts (`/contacts`)

- **Writes:** contact rows, tags (via API → `addContactTagAndDispatch`).
- **Triggers:** **Automations** on `tag_added` when tags are added from UI/API (and after CSV import via dispatch endpoint).
- **Feeds:** **Broadcast** audience, **Inbox** (contact on conversation), **Pipelines** (deal contact).

### Inbox (`/inbox`)

- **Reads:** conversations + messages (RLS by account).
- **Writes:** outbound via `/api/whatsapp/send`; assignment → **Automations** `conversation_assigned`.
- **Depends on:** webhook inserting **customer** messages; Realtime + 20–30s poll fallback (PR #12).

### Pipelines (`/pipelines`)

- **Deals** linked to `contact_id` (optional `conversation_id`).
- **Automations** can `create_deal`; manual board moves do **not** trigger automations.

### Broadcasts (`/broadcasts`)

- **Uses** contacts / tags / custom fields for audience.
- **Does not** create inbox messages on send (Meta handles delivery); status via webhook → `broadcast_recipients`.
- **Reply** on WhatsApp → webhook → **Inbox** message + broadcast `replied` count when matched by contact.

### Automations (`/automations`)

- **Triggers:** tag_added, keyword, new_message, first_inbound, interactive_reply, conversation_assigned, time_based (cron).
- **Needs:** `/api/automations/cron` for waits and schedules; tag recurrence pending rows.
- **Steps:** send template/message, wait, tags, deals, conditions, etc.

### Flows (`/flows`)

- **Runs first** on inbound (before keyword/new_message automations if consumed).
- **Needs:** `/api/flows/cron` for timeouts.
- **Shares:** contacts, conversations, messages, tags with automations.

---

## Verified in this repo (automated)

- **1115** unit/integration tests (`npm test`) — webhook idempotency, automations, broadcasts, inbox helpers, etc.
- Cross-module tag dispatch covered for UI/API; CSV import now calls `/api/contacts/import/dispatch-tag-automations` after bulk tag assign.

---

## Your issue: outreach OK but no reply in Inbox

This is almost always **inbound webhook configuration**, not Dashboard/UI logic.

### Production checklist

1. **Meta → WhatsApp → Configuration**  
   - Callback URL: `https://whatsapp.dynamoenterprises.in/api/whatsapp/webhook`  
   - Verify token = same as CRM **Settings → WhatsApp**  
   - Subscribe to **messages**

2. **Vercel environment (Production)**  
   - `META_APP_SECRET` — must match Meta app (else **401**, no inbound)  
   - `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`

3. **Settings → WhatsApp**  
   - Status **Connected**  
   - `phone_number_id` must match the number Meta sends in webhook metadata

4. **Diagnostic API (after deploy)**  
   - Signed-in agent: `GET /api/whatsapp/inbound-health`  
   - Shows env flags, last customer message in DB, hints

5. **Supabase SQL** (after you reply from phone):

```sql
SELECT m.created_at, m.content_text, c.phone
FROM messages m
JOIN conversations v ON v.id = m.conversation_id
JOIN contacts c ON c.id = v.contact_id
WHERE m.sender_type = 'customer'
ORDER BY m.created_at DESC
LIMIT 5;
```

- **No rows** → webhook never stored message (fix Meta/Vercel).  
- **Rows exist** → open **Inbox**, find contact by phone (duplicate contacts = wrong thread).

### Testing tip

Use a **second phone** (not the business SIM). Messaging your own outreach number from the same line as the API rarely behaves like a real customer.

---

## Sequence diagrams (simplified)

**Tag nurture:** Contact gets tag → Automation runs → Wait (cron) → Template → optional recurrence (cron).

**Broadcast:** Select audience (tags) → Send → Meta → status webhook → Broadcast detail; customer reply → webhook → **Inbox** + replied metric.

**Inbound chat:** Customer messages business number → webhook → contact + conversation + message → **Inbox** (+ Flows/Automations if configured).

---

## Known gaps (documented, not all fixed)

| Gap | Impact |
|-----|--------|
| CSV import historically skipped automations | Fixed via dispatch API after import |
| No browser push for every inbound | Toast in Inbox when Realtime works; use Inbox + refresh |
| Broadcast does not pre-create inbox thread | First **inbound** creates thread |
| Meta 131049 / 131026 | Delivery blocked by WhatsApp — see `docs/whatsapp-delivery-errors.md` |

For webhook-only debugging see `docs/whatsapp-inbox-troubleshooting.md`.
