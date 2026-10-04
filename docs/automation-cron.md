# Automation cron (Wait steps + time-based triggers)

**Wait** steps and **time-based** triggers need an external job that calls:

```http
GET https://YOUR-DOMAIN/api/automations/cron
x-cron-secret: YOUR_AUTOMATION_CRON_SECRET
```

Set **`AUTOMATION_CRON_SECRET`** on Vercel (Production).

## Vercel Hobby

Hobby cannot use minute-level Vercel Cron (this repo ships `"crons": []`).

### Primary (recommended): cron-job.org every 1 minute

GitHub Actions **does not** run every minute reliably (delays of hours are normal).

1. Create a free job at [cron-job.org](https://cron-job.org).
2. URL: `https://YOUR-DOMAIN/api/automations/cron`
3. Schedule: **every 1 minute**
4. Header: `x-cron-secret` = your `AUTOMATION_CRON_SECRET`
5. Method: **GET**

This gives predictable Wait timing (~1 minute after `run_at`).

### Secondary: GitHub Actions

Workflow `.github/workflows/automation-cron.yml` runs about **every 5 minutes**
as a backup. Secrets: `CRM_CRON_BASE_URL`, `AUTOMATION_CRON_SECRET`.

Manual **Run workflow** is good for testing only — do not rely on it for schedules.

### Piggyback

Tag changes and inbound WhatsApp also resume due waits for your account, but
**long nurture (7–180 days)** still needs cron-job.org (or similar) running 24/7.

## Wait step timing

Logs show **`until …` (UTC)** on the wait step. The message sends on the first
cron ping **after** that time.

| Pinger | Typical slack after `run_at` |
|--------|------------------------------|
| cron-job.org **1 min** | ~0–1 min |
| GitHub **~5 min** | ~0–5 min |
| Tag/message only | Until next event (unpredictable) |

## Verify

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -H "x-cron-secret: YOUR_SECRET" \
  "https://YOUR-DOMAIN/api/automations/cron"
```

Expect **200** and JSON like `{"processed":0,"scheduled":0}`.
