"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2 } from "lucide-react";
import type { RegisterResult } from "@/services/congressos-public.service";

export function StepSuccess({
  result,
  hasEmail,
}: {
  result: RegisterResult;
  hasEmail: boolean;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(result.token, { width: 320, margin: 2 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [result.token]);

  const firstName = result.participant_first_name;

  return (
    <div className="mx-auto max-w-md space-y-6 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/[0.08] ring-1 ring-primary/15">
          <CheckCircle2 className="h-9 w-9 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {firstName ? `Prontinho, ${firstName}!` : "Brinde liberado!"}
        </h1>
        {result.alreadyRegistered ? (
          <p className="text-sm text-muted-foreground">
            Você já tinha um brinde reservado — é este aqui.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Mostre este código no balcão para retirar
            {result.gift_name ? ` o seu ${result.gift_name}` : " o seu brinde"}.
          </p>
        )}
      </div>

      <div className="flex justify-center">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="QR code do seu brinde"
            className="h-56 w-56 rounded-xl border bg-white p-2"
          />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center text-sm text-muted-foreground">
            Gerando código...
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Código do brinde
        </p>
        <p className="text-4xl font-bold tracking-[0.3em] text-adds-navy">
          {result.short_code}
        </p>
      </div>

      {hasEmail && (
        <p className="text-sm text-muted-foreground">
          Enviamos a confirmação para o seu e-mail. 💙
        </p>
      )}
    </div>
  );
}
