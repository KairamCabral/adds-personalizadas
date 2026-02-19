"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

interface AgreementStatusProps {
  status: "signed" | "pending" | "revoked" | "expired" | null;
  signedAt?: string | null;
  linkUrl?: string | null;
  onCopyLink?: () => void;
}

export function AgreementStatus({
  status,
  signedAt,
  linkUrl,
  onCopyLink,
}: AgreementStatusProps) {
  if (status === "signed" && signedAt) {
    return (
      <Badge
        variant="secondary"
        className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Termo assinado em {formatDate(signedAt)}
      </Badge>
    );
  }

  if (status === "pending" && linkUrl) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        >
          <Clock className="mr-1 h-3 w-3" />
          Aguardando assinatura
        </Badge>
        {onCopyLink && (
          <button
            type="button"
            onClick={onCopyLink}
            className="text-xs text-primary hover:underline"
          >
            Copiar link
          </button>
        )}
      </div>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="bg-destructive/10 text-destructive dark:bg-destructive/20"
    >
      <XCircle className="mr-1 h-3 w-3" />
      {status === "revoked"
        ? "Termo revogado"
        : status === "expired"
          ? "Link expirado"
          : "Integração bloqueada"}
    </Badge>
  );
}
