# WhatsApp delivery errors (broadcasts & templates)

These come from **Meta**, not from a bug in the CRM. The API accepted the send; WhatsApp later reported **failed** on the status webhook.

## Common codes

| Code | Meaning | What to do |
|------|---------|------------|
| **131049** | Marketing / ecosystem limit — WhatsApp did not deliver this template to this user (per-user marketing cap, low engagement, or quality protection). | Do **not** retry immediately. Wait 24–72h. Have the contact **message you first** (opens the 24h window), or use a **utility** (non-marketing) template when appropriate. |
| **131026** | Undeliverable — number not on WhatsApp, invalid, blocked, or cannot receive this message type. | Check phone format (E.164, e.g. `+918080607050`). Confirm with the contact. Retrying rarely helps until the number or block status changes. |
| **131047** | Re-engagement window closed — no inbound message from the contact in the last 24 hours. | Contact must send you a WhatsApp message before another **marketing/template** push outside approved windows. |

## Broadcast tips

- Large **marketing** campaigns will always have some **131049** failures — that is expected on cold lists.
- **Retry failed** re-sends the same template; it will **not** fix 131049 if Meta still blocks that user.
- Improve deliverability: opt-in lists, smaller batches, spacing sends, higher-quality templates, and contacts who have recently chatted with you.
