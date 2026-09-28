"use client";

import { useState, type ReactNode, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyTextProps {
  /** O que aparece na tela (pode ser formatado: "(48) 99916-8070"). */
  children: ReactNode;
  /**
   * O que vai para a área de transferência. Para telefone e CPF, mande só os
   * dígitos: é o que cola limpo na busca do Tiny e no WhatsApp.
   */
  value: string | null | undefined;
  /** Nome do dado no aviso ("Telefone copiado."). */
  label?: string;
  className?: string;
  /** Exibido quando não há valor. */
  empty?: string;
}

/**
 * Texto que se copia com um clique. Pensado para listas onde a pessoa precisa
 * levar o dado para outro sistema (Tiny, WhatsApp, planilha).
 *
 * Para de propagar o clique: a linha da tabela pode ter ação própria
 * (`onRowClick` do DataTable), e copiar não deve abrir o registro.
 */
export function CopyText({
  children,
  value,
  label = "Valor",
  className,
  empty = "—",
}: CopyTextProps) {
  const [copied, setCopied] = useState(false);
  const text = (value ?? "").trim();

  if (!text) return <span className="text-muted-foreground">{empty}</span>;

  const copy = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copiado.`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sem permissão de área de transferência (ou contexto não seguro).
      toast.error("Não foi possível copiar.", { description: text });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copiar ${label.toLowerCase()}: ${text}`}
      aria-label={`Copiar ${label.toLowerCase()}`}
      className={cn(
        "group inline-flex max-w-full items-center gap-1 rounded text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span className="truncate">{children}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
