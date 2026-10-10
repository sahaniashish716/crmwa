# Go live: WhatsApp CRM (Wati-style operations)

This fork is a **full WhatsApp CRM** (Inbox, Broadcasts, Automations, Flows, Pipelines, AI). To behave like **WhatsApp Business + a tool such as Wati**, production must satisfy **three layers**:

1. **Meta Cloud API** — number registered, WABA subscribed, app webhook receiving **`messages`**
2. **CRM backend** — webhook persists inbound rows; automations cron runs waits/schedules
3. **Agents in the browser** — Inbox realtime, optional **desktop notifications**, correct account membership

Outbound-only (templates/broadcasts) can work while **inbound is completely broken**. That matches “I can send but never see replies.”

---

## Layer 1 — Meta & number registration (do first)

### A. Two-step PIN + Register inbound (production numbers)

1. Meta **Business Manager / WhatsApp Manager** → your **phone number** → **Two-step verification** → note the **6-digit PIN**.
2. CRM **Settings → WhatsApp** → enter PIN → **Register inbound**.
3. Confirm **`registered_at`** is set (amber “Not registered” banner should disappear).

Without this, Meta often **does not route inbound message webhooks** to your app.

### B. App webhook (Developer Console)

1. Callback URL: `https://<your-domain>/api/whatsapp/webhook`
2. **Verify token** = same string as in CRM Settings (saved encrypted in DB).
3. **Subscribe** webhook field **`messages`** (scroll the fields list — not only `account_*` fields).
4. **Verify and save** must succeed once.

Opening the webhook URL in a browser without query params shows `Missing verification parameters` — that is **normal**.

### C. Vercel environment

| Variable | Purpose |
|----------|---------|
| `META_APP_SECRET` | Webhook signature; wrong value → **401** → no inbound |
| `ENCRYPTION_KEY` | Decrypt stored WhatsApp tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook inserts |
| `AUTOMATION_CRON_SECRET` | External cron for waits / time-based automations |

---

## Layer 2 — Database migrations

Run all files in `supabase/migrations/` on your Supabase project (SQL editor or CLI).

Critical for Inbox:

| Migration | Why |
|-----------|-----|
| **037** | `bump_conversation_on_inbound` — list preview updates |
| **036** | One conversation per contact (no split threads) |
| **038** | `broadcast_recipients.template_params` |

If customer rows exist in SQL but the list shows old dates, run the repair SQL in `docs/whatsapp-inbox-troubleshooting.md`.

---

## Layer 3 — Agent experience (like WhatsApp Business app)

| Feature | Where | Notes |
|---------|--------|------|
| **Inbox chat** | Inbox | 24h session; templates after expiry |
| **Desktop pop-ups** | Settings → profile → Browser notifications | Requires permission; tab must be open |
| **In-app toasts** | Inbox | New customer message (realtime + poll fallback) |
| **Notifications page** | Notifications | Assignment events today |
| **Contacts / tags** | Contacts | Shared per account |
| **Broadcasts** | Broadcasts | Audience tags, CSV, custom fields, template params |
| **Automations** | Automations | Tags, waits, recurrence (cron required) |
| **Flows** | Flows | Interactive menus |
| **Pipelines** | Pipelines | Deals linked to contacts |
| **AI** | AI Agents | Leave as configured |

---

## Scheduling (what exists today)

| Type | Status |
|------|--------|
| **Automation Wait / time-based** | Needs **`/api/automations/cron`** on a 1-min external cron — see `docs/automation-cron.md` |
| **Tag recurrence** | Same cron + recurrence config |
| **Broadcast “send later”** | DB supports `scheduled_at`; **UI is send-now** — scheduled send cron is a planned enhancement |
| **Message schedule like Wati campaigns** | Use **Broadcast now** or add scheduled broadcast cron (roadmap) |

---

## Health checks

While logged in:

- `GET /api/whatsapp/inbound-health` — account-wide inbound readiness
- `GET /api/whatsapp/inbound-health?phone=%2B91XXXXXXXXXX` — one contact’s stored customer messages

Settings → **Check inbound / Inbox path** runs the first check.

---

## Wati-style parity (roadmap)

Already strong: template broadcasts, automations, flows, inbox, API, multi-user accounts.

Typical Wati additions to plan as separate projects:

- Scheduled broadcast cron + UI datetime picker
- Campaign analytics dashboards (reply rate by template)
- Team inbox assignment rules / round-robin
- WhatsApp catalog / commerce messages
- Official **Web Push** when browser is closed (service worker)
- CSAT / quick-reply libraries per industry

Implement these incrementally on **your fork**; upstream template stays opinionated.

---

## Production test script (15 minutes)

1. Register inbound + webhook **messages** subscribed.
2. From a **second phone**, reply **hi** to your business number.
3. Supabase: `SELECT * FROM messages WHERE sender_type = 'customer' ORDER BY created_at DESC LIMIT 3;`
4. Inbox: thread at top, customer bubble, session timer active.
5. Enable browser notifications; reply again — desktop pop-up (tab open).
6. Send a **small broadcast** (2–3 test contacts); confirm delivery and one reply increments **replied** count.
7. Trigger one **automation** (tag added) and confirm cron if using Wait steps.

If step 3 fails, fix Layer 1 before changing CRM code.
