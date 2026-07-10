"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Gift,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  searchGiftForRedeem,
  redeemGift,
  type RedeemSearchResult,
} from "@/services/congressos-gifts.service";
import { classifyRedeemOutcome } from "@/lib/congressos/redeem-outcome";

interface RedeemConsoleProps {
  editionId: string;
  editionName: string;
  giftName: string | null;
}

interface SessionEntry {
  name: string;
  shortCode: string;
  at: string; // HH:mm
}

function maskDoc(doc: string | null): string {
  if (!doc) return "";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
  if (d.length === 14) return `••.${d.slice(2, 5)}.${d.slice(5, 8)}/••••-••`;
  return d;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RedeemConsole({
  editionId,
  editionName,
  giftName,
}: RedeemConsoleProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<RedeemSearchResult[]>([]);
  const [active, setActive] = useState<RedeemSearchResult | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const focusInput = () => inputRef.current?.focus();

  // Refoca o campo ao trocar de edição (tablet no estande).
  useEffect(() => {
    setQuery("");
    setResults([]);
    setActive(null);
    setSearched(false);
    focusInput();
  }, [editionId]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearched(false);
    setActive(null);
    try {
      const found = await searchGiftForRedeem(editionId, q);
      setResults(found);
      setSearched(true);
      if (found.length === 1) setActive(found[0]);
    } catch {
      toast.error("Não foi possível buscar agora. Tente de novo.");
    } finally {
      setSearching(false);
    }
  };

  const resetForNext = () => {
    setQuery("");
    setResults([]);
    setActive(null);
    setSearched(false);
    focusInput();
  };

  const handleRedeem = async (r: RedeemSearchResult) => {
    if (redeeming) return;
    setRedeeming(true);
    try {
      const res = await redeemGift(r.token);
      const fb = classifyRedeemOutcome(res?.outcome);
      if (res?.success) {
        toast.success(fb.title, { description: `${r.name ?? "Participante"}` });
        setSessionCount((c) => c + 1);
        setSessionLog((log) =>
          [
            {
              name: r.name ?? "Participante",
              shortCode: r.short_code,
              at: new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
            ...log,
          ].slice(0, 8)
        );
        resetForNext();
      } else {
        // JA_RETIRADO / CANCELADO / NAO_ENCONTRADO / SEM_PERMISSAO
        if (fb.tone === "warning") toast(fb.title, { description: fb.description });
        else toast.error(fb.title, { description: fb.description });
        // Reflete o estado real no card (ex.: já retirado).
        setActive({
          ...r,
          status: res?.outcome === "JA_RETIRADO" ? "RETIRADO" : r.status,
          redeemed_at: res?.redeemed_at ?? r.redeemed_at,
        });
        focusInput();
      }
    } catch {
      toast.error("Erro ao confirmar a retirada. Tente de novo.");
      focusInput();
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* Coluna principal: busca + resultado */}
      <div className="space-y-5">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Código de 6 dígitos, CPF ou nome"
              className="h-14 pl-12 pr-28 text-lg"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button
              type="submit"
              disabled={!query.trim() || searching}
              className="absolute right-2 top-1/2 h-10 -translate-y-1/2"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Buscar
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            O campo fica sempre pronto — use o leitor de código de barras ou
            digite. Enter para buscar.
          </p>
        </form>

        {/* Resultado ativo */}
        {active && (
          <ResultCard
            result={active}
            giftName={giftName}
            redeeming={redeeming}
            onRedeem={() => handleRedeem(active)}
          />
        )}

        {/* Vários resultados (busca por nome) → escolher */}
        {!active && results.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {results.length} participantes encontrados — selecione:
            </p>
            {results.map((r) => (
              <button
                key={r.token}
                type="button"
                onClick={() => setActive(r)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-secondary/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {maskDoc(r.document)} · código {r.short_code}
                  </p>
                </div>
                <StatusPill status={r.status} />
              </button>
            ))}
          </div>
        )}

        {/* Nada encontrado */}
        {searched && !searching && results.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
            <div className="mb-3 rounded-full bg-muted p-4">
              <Search className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum brinde encontrado</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Confira o código, o CPF ou o nome e tente novamente.
            </p>
          </div>
        )}

        {/* Estado inicial */}
        {!active && !searched && results.length === 0 && !searching && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <div className="mb-3 rounded-full bg-dashboard-primary/10 p-4">
              <Gift className="h-8 w-8 text-dashboard-primary" />
            </div>
            <p className="font-medium">Pronto para a retirada</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Busque o participante para confirmar a entrega do brinde
              {giftName ? ` (${giftName})` : ""}.
            </p>
          </div>
        )}
      </div>

      {/* Coluna lateral: sessão */}
      <aside className="space-y-4">
        <div className="rounded-xl border bg-gradient-to-br from-dashboard-primary/[0.06] to-transparent p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <PackageCheck className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Entregues nesta sessão
            </span>
          </div>
          <p className="mt-1 text-3xl font-bold tabular-nums">{sessionCount}</p>
          <p className="text-xs text-muted-foreground">{editionName}</p>
        </div>

        {sessionLog.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Últimas entregas
            </p>
            {sessionLog.map((s, i) => (
              <div
                key={`${s.shortCode}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {s.shortCode}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {s.at}
                </span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "RETIRADO")
    return (
      <Badge
        variant="outline"
        className="shrink-0 whitespace-nowrap border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        Retirado
      </Badge>
    );
  if (status === "CANCELADO")
    return (
      <Badge variant="outline" className="shrink-0 text-destructive">
        Cancelado
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="shrink-0 whitespace-nowrap border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      Pendente
    </Badge>
  );
}

function ResultCard({
  result,
  giftName,
  redeeming,
  onRedeem,
}: {
  result: RedeemSearchResult;
  giftName: string | null;
  redeeming: boolean;
  onRedeem: () => void;
}) {
  const pendente = result.status === "PENDENTE";
  const retirado = result.status === "RETIRADO";
  const cancelado = result.status === "CANCELADO";

  return (
    <div
      className={cn(
        "animate-scale-in rounded-2xl border p-5 shadow-sm",
        pendente && "border-dashboard-primary/30 bg-dashboard-primary/[0.04]",
        retirado &&
          "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/20",
        cancelado && "border-destructive/40 bg-destructive/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight">
            {result.name ?? "Participante"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {maskDoc(result.document)} · código{" "}
            <span className="font-mono font-medium text-foreground">
              {result.short_code}
            </span>
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            <Gift className="h-4 w-4 text-muted-foreground" />
            <span>{giftName ?? "Brinde"}</span>
          </div>
        </div>
        <StatusPill status={result.status} />
      </div>

      <div className="mt-5">
        {pendente && (
          <Button
            size="lg"
            className="h-14 w-full text-base"
            onClick={onRedeem}
            disabled={redeeming}
          >
            {redeeming ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Confirmar retirada
              </>
            )}
          </Button>
        )}

        {retirado && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-100/70 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              Brinde já retirado
              {result.redeemed_at
                ? ` em ${fmtDateTime(result.redeemed_at)}`
                : ""}
              .
            </span>
          </div>
        )}

        {cancelado && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Este brinde foi cancelado e não pode ser entregue.</span>
          </div>
        )}
      </div>
    </div>
  );
}
