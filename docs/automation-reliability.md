# Automation reliability checklist

Use this after deploy or when debugging “random” wait / schedule timing.

## Required production setup

1. **`AUTOMATION_CRON_SECRET`** on Vercel Production.
2. **GitHub Actions** `Automation cron drain` (every 1 minute) with secrets
   `CRM_CRON_BASE_URL` and `AUTOMATION_CRON_SECRET`.
3. **Supabase migration `043_automation_schedule_claim.sql`** applied (atomic
   time-based dedupe). Safe to run idempotently via Supabase SQL or CLI.

## Expected timing

| Feature | Typical delay |
|---------|----------------|
| Wait **5 minutes** | ~5–6 minutes (1-minute GitHub cron) |
| Time-based `*/5 * * * *` | ~5 minutes between **finished** runs |
| Daily `09:00` + timezone | Fires on first cron tick in that minute |

## Log statuses

| Status | Meaning |
|--------|---------|
| **partial** | Parked on a Wait — cron must resume |
| **success** | All steps finished |
| **failed** | Step error or wait enqueue failed |

## Common mistakes

- **Time-based + Send template/message** — blocked at activation (no contact on
  schedule). Use **tag / keyword / new message** trigger instead.
- **Two automations for “message after 5 min”** — use **one** flow:
  `trigger → Wait 5 min → Send`.
- **Cron not running** — GitHub log must show JSON, not “Skipping…”.

## Verify

```bash
curl -s -H "x-cron-secret: YOUR_SECRET" \
  "https://YOUR-DOMAIN/api/automations/cron"
```
