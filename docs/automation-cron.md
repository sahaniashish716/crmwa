# Automation cron (Wait steps + time-based triggers)

**Wait** steps and **time-based** triggers depend on a background job that
calls:

```http
GET https://YOUR-DOMAIN/api/automations/cron
x-cron-secret: YOUR_AUTOMATION_CRON_SECRET
```

Set **`AUTOMATION_CRON_SECRET`** on Vercel (Production). On Vercel Cron
(Pro), also set **`CRON_SECRET`** to the same value.

## Vercel Hobby

Hobby plans cannot run Vercel Cron more than **once per day**. This repo ships
with an empty `vercel.json` cron list so deploys succeed. Use one of:

1. **GitHub Actions** (recommended): enable workflow
   `.github/workflows/automation-cron.yml` and add repository secrets
   `AUTOMATION_CRON_SECRET` and `CRM_CRON_BASE_URL` (e.g.
   `https://crmwa-dynamoenterprises.vercel.app`).

2. **cron-job.org** (or similar): ping the URL every 1–5 minutes with the
   `x-cron-secret` header.

3. **Partial piggyback**: after inbound WhatsApp messages (and other automation
   triggers), the engine drains due waits in-process. Idle contacts still need
   an external ping every few minutes for reliable Wait steps and time-based
   schedules.

## Time-based schedules

- Use **cron** (`0 9 * * 1-5`) or daily **`HH:mm`** (24h) in the trigger.
- Optional **timezone** (IANA, e.g. `Asia/Kolkata`); defaults to UTC if empty.

## Verify

```bash
curl -s -H "x-cron-secret: YOUR_SECRET" \
  "https://YOUR-DOMAIN/api/automations/cron"
```

Expect JSON: `{"processed":0,"scheduled":0}` (numbers vary).
