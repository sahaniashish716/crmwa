"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type HealthBody = {
  ok?: boolean;
  checks?: {
    locally_registered?: boolean;
    meta_app_secret_set?: boolean;
    whatsapp_status_connected?: boolean;
  };
  hints?: string[];
  last_customer_message?: { at?: string } | null;
};

/**
 * Shown on Inbox/Dashboard until WhatsApp inbound is fully wired (Meta
 * /register + webhook messages). Outbound-only "Connected" is not enough.
 */
export function WhatsAppInboundSetupBanner() {
  const [health, setHealth] = useState<HealthBody | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/whatsapp/inbound-health");
        const body = (await res.json()) as HealthBody;
        if (!cancelled) setHealth(body);
      } catch {
        if (!cancelled) setHealth(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const registered = health?.checks?.locally_registered === true;
  const fullyOk = health?.ok === true;

  if (fullyOk && registered) return null;

  const primaryHint =
    health?.hints?.[0] ??
    "Complete WhatsApp inbound setup in Settings (two-step PIN + Meta webhook messages field).";

  return (
    <div
      className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-amber-50">
              Customer replies will not appear in Inbox until inbound is registered
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
              {primaryHint} Outbound templates can work while inbound is broken.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
              <li className="flex items-center gap-1.5">
                {registered ? (
                  <CheckCircle2 className="size-3 text-emerald-400" />
                ) : (
                  <span className="inline-block size-3 rounded-full bg-amber-500/60" />
                )}
                CRM: Register inbound (two-step PIN)
              </li>
              <li className="flex items-center gap-1.5">
                {health?.checks?.meta_app_secret_set ? (
                  <CheckCircle2 className="size-3 text-emerald-400" />
                ) : (
                  <span className="inline-block size-3 rounded-full bg-amber-500/60" />
                )}
                Vercel: META_APP_SECRET
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-full bg-amber-500/60" />
                Meta Developer: webhook field <strong className="font-medium">messages</strong> subscribed
              </li>
            </ul>
          </div>
        </div>
        <Button size="sm" variant="secondary" className="shrink-0" render={<Link href="/settings" />}>
          Fix in Settings
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
