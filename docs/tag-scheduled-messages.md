# Tag-based scheduled messages (7 days, 30 days, months)

Use **one automation per milestone** — do not put every delay in a single chain unless
you want strict sequencing.

## Recommended pattern

| Goal | Automation |
|------|------------|
| Message 7 days after tag | Trigger **Tag added** → Wait **7 days** → Send template |
| Message 30 days after tag | Separate automation: same tag → Wait **30 days** → Send |
| 6 months | Wait **6 months** (or **180 days**) → Send |

When the tag is applied **once**, every active automation for that tag runs and
schedules its own wait. Each log row shows **until YYYY-MM-DD…** (UTC) for the resume time.

## Requirements

1. **GitHub Actions** `Automation cron drain` every **1 minute** (repo secrets set).
2. **Vercel** `AUTOMATION_CRON_SECRET` matches GitHub.
3. Re-applying the **same** tag does **not** restart the automation; remove the tag
   and add again if you need a fresh schedule.

## Repeat every X (until reply)

On **Tag added** trigger, enable **Repeat entire automation on an interval**. After
each **successful** run (all steps finished), the next run is scheduled automatically —
no re-tagging. Inbound WhatsApp stops the loop when **Stop repeating when the contact
sends a message** is checked (default).

## Timing accuracy

- **Minutes / hours:** ~1 minute slack (cron tick).
- **Days / weeks / months:** calendar math (e.g. 6 months = same day-of-month rule as date-fns).
- Message sends on the **first cron ping after** `run_at` (usually within 1 minute).
