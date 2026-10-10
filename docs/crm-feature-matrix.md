# CRM feature matrix (current fork vs typical Wati-style tool)

Legend: **Yes** = implemented and intended for production use · **Partial** = works with gaps · **Ops** = depends on Meta/Vercel/cron setup · **Planned** = not built yet

| Area | This CRM | Notes |
|------|----------|--------|
| WhatsApp outbound templates | **Yes** | Meta Cloud API |
| Inbox two-way chat | **Ops** | Requires Register inbound + `messages` webhook |
| 24h session / template re-engage | **Yes** | Composer gates |
| Contact CRUD, tags, custom fields | **Yes** | Account-scoped |
| CSV import | **Yes** | Deduped phones |
| Broadcast audiences | **Yes** | All, tags, field filter, CSV, exclude tags |
| Broadcast template variables | **Yes** | Per-contact params + DB column 038 |
| Broadcast scheduling | **Partial** | Schema `scheduled_at`; UI send-now only |
| Delivery/read/replied stats | **Yes** | Webhook statuses |
| Automations (triggers, waits) | **Yes** | Cron for due waits |
| Tag recurrence | **Yes** | Fork-specific; needs cron |
| Flows (buttons/lists) | **Yes** | |
| Pipelines / deals | **Yes** | |
| AI auto-reply / knowledge | **Yes** | User asked to keep as-is |
| Desktop notifications | **Partial** | Opt-in; tab must be open |
| Mobile push (app closed) | **Planned** | No service worker |
| Multi-agent / roles | **Yes** | Admin/agent |
| Public REST API | **Yes** | See `docs/public-api.md` |
| MCP integration | **Yes** | Optional |

**Highest ROI for “feels like WhatsApp Business”:** fix **inbound registration** (see `docs/go-live-whatsapp-crm.md`), then enable **browser notifications**, then wire **automation cron**.
