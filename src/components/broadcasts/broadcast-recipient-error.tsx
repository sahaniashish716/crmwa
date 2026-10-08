'use client';

import {
  parseWhatsAppDeliveryError,
  whatsAppDeliveryHint,
} from '@/lib/whatsapp/delivery-errors';

export function BroadcastRecipientError({
  errorMessage,
}: {
  errorMessage: string | null | undefined;
}) {
  if (!errorMessage?.trim()) {
    return <span className="text-muted-foreground">-</span>;
  }

  const parsed = parseWhatsAppDeliveryError(errorMessage);
  const hint = whatsAppDeliveryHint(parsed?.code ?? null);

  return (
    <div className="max-w-md space-y-1 text-xs" title={errorMessage}>
      <p className="whitespace-pre-wrap break-words text-red-400">{errorMessage}</p>
      {hint ? (
        <p className="whitespace-pre-wrap break-words text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
