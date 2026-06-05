"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, MessageCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createManualDispatch,
  getNpsSurveys,
  npsPublicUrl,
  searchClients,
  type ClientLite,
  type ManualDispatchResult,
} from "@/services/nps-admin.service";

function waLink(phone: string, name: string, url: string): string {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  const first = name.trim().split(/\s+/)[0] ?? "";
  const msg = `Olá${first ? ", " + first : ""}! Tudo bem? Aqui é da ADDS. Queremos muito saber a sua opinião — leva menos de 30 segundos: ${url}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export function NpsManualSection() {
  const [term, setTerm] = useState("");
  const [client, setClient] = useState<ClientLite | null>(null);
  const [surveyId, setSurveyId] = useState("");
  const [result, setResult] = useState<ManualDispatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const { data: surveys = [] } = useQuery({ queryKey: ["nps", "surveys"], queryFn: getNpsSurveys });
  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ["nps", "client-search", term],
    queryFn: () => searchClients(term),
    enabled: term.trim().length >= 2 && !client,
  });

  // default: primeira campanha ativa (relacional preferida), senão a primeira
  useEffect(() => {
    if (surveyId || surveys.length === 0) return;
    const relAtiva = surveys.find((s) => s.is_active && s.type === "RELACIONAL");
    const ativa = surveys.find((s) => s.is_active);
    setSurveyId((relAtiva ?? ativa ?? surveys[0]).id);
  }, [surveys, surveyId]);

  const gen = useMutation({
    mutationFn: () => createManualDispatch({ surveyId, clientId: client!.id }),
    onSuccess: (r) => {
      setResult(r);
      toast.success("Link gerado.");
      qc.invalidateQueries({ queryKey: ["nps", "dispatch-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar link."),
  });

  const url = result ? npsPublicUrl(result.token) : "";

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado.");
    setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setResult(null);
    setClient(null);
    setTerm("");
  }

  if (surveys.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Crie uma campanha na aba “Campanhas” para poder gerar links de pesquisa.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base text-[#0b4269]">Gerar link de pesquisa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Gere um link rastreável e envie você mesmo pelo WhatsApp do cliente.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Campanha */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0b4269]">Campanha</label>
          <select
            value={surveyId}
            onChange={(e) => setSurveyId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_active ? "" : " (pausada)"}
              </option>
            ))}
          </select>
        </div>

        {/* Cliente */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0b4269]">Cliente</label>
          {client ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{client.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {client.phone ?? "sem telefone"} · {client.email ?? "sem e-mail"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Buscar cliente pelo nome…"
                  className="pl-8"
                />
              </div>
              {term.trim().length >= 2 && (
                <div className="mt-2 max-h-56 overflow-auto rounded-md border">
                  {isFetching ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
                  ) : searchResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                  ) : (
                    searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClient(c)}
                        className="flex w-full flex-col items-start border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                      >
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.phone ?? "sem telefone"} · {c.email ?? "sem e-mail"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Ação / resultado */}
        {!result ? (
          <Button
            onClick={() => gen.mutate()}
            disabled={!client || !surveyId || gen.isPending}
            className="bg-[#21add6] text-white hover:bg-[#1c97bb]"
          >
            {gen.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…
              </>
            ) : (
              "Gerar link"
            )}
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Link da pesquisa
              </label>
              <div className="flex gap-2">
                <Input readOnly value={url} className="text-xs" onFocus={(e) => e.target.select()} />
                <Button variant="outline" size="icon" onClick={copy} title="Copiar">
                  {copied ? <Check className="h-4 w-4 text-[#2ecc71]" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {result.phone ? (
              <a href={waLink(result.phone, result.clientName, url)} target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-[#25D366] text-white hover:bg-[#1fb855]">
                  <MessageCircle className="mr-2 h-4 w-4" /> Abrir no WhatsApp
                </Button>
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cliente sem telefone cadastrado — copie o link e envie pelo canal que preferir.
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={reset}>
              Gerar para outro cliente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
