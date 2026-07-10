"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, Trophy, Gift, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  drawRaffleWinner,
  getEditionDraws,
  getRaffleNumberedCount,
  type RaffleDrawResult,
} from "@/services/congressos-raffle.service";
import { classifyDrawOutcome } from "@/lib/congressos/draw-outcome";
import type { EventEdition } from "@/types/database.types";

const ELIGIBILITY_LABEL: Record<string, string> = {
  ALL: "Todos os inscritos",
  QUALIFIED: "Qualificados (dentista/distribuidora)",
  GIFT_REDEEMED: "Quem retirou o brinde",
};

function padNum(n: number | null): string {
  return n == null ? "—" : String(n).padStart(4, "0");
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

export function RafflePanel({
  editionId,
  edition,
}: {
  editionId: string;
  edition: EventEdition;
}) {
  const queryClient = useQueryClient();
  const [todayOnly, setTodayOnly] = useState(false);
  const [winner, setWinner] = useState<RaffleDrawResult | null>(null);

  const { data: draws = [], isLoading: drawsLoading } = useQuery({
    queryKey: ["edition_draws", editionId],
    queryFn: () => getEditionDraws(editionId),
  });

  const { data: numbered = 0 } = useQuery({
    queryKey: ["edition_raffle_numbered", editionId],
    queryFn: () => getRaffleNumberedCount(editionId),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const forDate = todayOnly
        ? new Date().toISOString().slice(0, 10)
        : null;
      return drawRaffleWinner(editionId, forDate);
    },
    onSuccess: (res) => {
      const fb = classifyDrawOutcome(res?.outcome);
      if (res?.success) {
        setWinner(res);
        toast.success(fb.title);
        queryClient.invalidateQueries({
          queryKey: ["edition_draws", editionId],
        });
      } else {
        setWinner(null);
        if (fb.tone === "warning") toast(fb.title, { description: fb.description });
        else toast.error(fb.title, { description: fb.description });
      }
    },
    onError: () => toast.error("Erro ao sortear. Tente de novo."),
  });

  return (
    <div className="space-y-6">
      {/* Config + ação */}
      <Card className="border-adds-orange/30 bg-adds-orange/[0.04]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="gap-1">
              <Gift className="h-3 w-3" />
              {edition.raffle_prize || "Prêmio a definir"}
            </Badge>
            <Badge variant="secondary">
              {ELIGIBILITY_LABEL[edition.raffle_eligibility] ??
                edition.raffle_eligibility}
            </Badge>
            {edition.raffle_allow_repeat_winners && (
              <Badge variant="secondary">Permite repetir ganhador</Badge>
            )}
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {numbered.toLocaleString("pt-BR")} com número
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="today_only"
                checked={todayOnly}
                onCheckedChange={setTodayOnly}
              />
              <Label htmlFor="today_only" className="text-sm">
                Sortear só entre os inscritos de hoje
              </Label>
            </div>
            <Button
              size="lg"
              className="h-12 bg-adds-orange text-base hover:bg-adds-orange/90"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sorteando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Sortear ganhador
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revelação do ganhador */}
      {winner?.success && (
        <div className="animate-scale-in rounded-2xl border-2 border-adds-orange/40 bg-adds-orange/[0.06] p-8 text-center">
          <div className="mb-2 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-adds-orange/15">
              <Trophy className="h-7 w-7 text-adds-orange" />
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Número da sorte
          </p>
          <p className="text-5xl font-bold tracking-[0.2em] text-adds-orange">
            {padNum(winner.raffle_number)}
          </p>
          <p className="mt-2 text-xl font-bold tracking-tight">
            {winner.participant_name ?? "Participante"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sorteado entre {winner.pool_size ?? 0} elegíveis
            {edition.raffle_prize ? ` · ${edition.raffle_prize}` : ""}
          </p>
        </div>
      )}

      {/* Histórico de ganhadores */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Ganhadores</h4>
        {drawsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : draws.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum sorteio realizado ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {draws.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "shrink-0 rounded-md bg-adds-orange/10 px-2 py-1 font-mono text-sm font-bold text-adds-orange"
                    )}
                  >
                    {padNum(d.raffle_number)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {d.participant_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.prize ? `${d.prize} · ` : ""}
                      {fmtDateTime(d.drawn_at)}
                      {d.drawn_for_date ? " · sorteio do dia" : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  entre {d.pool_size ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
