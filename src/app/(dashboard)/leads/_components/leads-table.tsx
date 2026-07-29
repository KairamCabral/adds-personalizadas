"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Copy, MessageCircle, Repeat2, Star, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPhone, type LeadWithContact } from "@/services/leads.service";

/**
 * Temperatura por idade. O lead esfria sozinho na tela, o que comunica urgência
 * sem precisar de texto e sem depender só de cor — cada faixa tem rótulo no
 * atributo `title` e a ordem da lista já reforça a leitura.
 */
function temperatura(criadoEm: string): { classe: string; rotulo: string } {
  const horas = (Date.now() - new Date(criadoEm).getTime()) / 36e5;
  if (horas < 1) return { classe: "bg-red-500", rotulo: "Chegou agora" };
  if (horas < 24) return { classe: "bg-amber-500", rotulo: "Menos de 24h" };
  if (horas < 24 * 7) return { classe: "bg-sky-500", rotulo: "Esta semana" };
  return { classe: "bg-muted-foreground/40", rotulo: "Mais de 7 dias" };
}

function mensagemWhatsApp(lead: LeadWithContact): string {
  const primeiroNome = lead.contact?.name?.trim().split(/\s+/)[0];
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  return `${saudacao} Aqui é da ADDS Brasil. Você pediu o orçamento da escova para protocolo ADDS Implant — posso te enviar as condições para dentistas?`;
}

interface Props {
  leads: LeadWithContact[];
  onToggleContacted: (lead: LeadWithContact, contatado: boolean) => Promise<void>;
  onOpen: (lead: LeadWithContact) => void;
}

export function LeadsTable({ leads, onToggleContacted, onOpen }: Props) {
  const [salvando, setSalvando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiarNumero = async (lead: LeadWithContact) => {
    try {
      await navigator.clipboard.writeText(formatPhone(lead.phone));
      setCopiado(lead.id);
      // Confirmação visual no próprio botão, além do toast: o toast pode
      // aparecer fora do campo de visão em telas grandes.
      setTimeout(() => setCopiado((atual) => (atual === lead.id ? null : atual)), 1500);
      toast.success("Número copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const alternarContato = async (lead: LeadWithContact, contatado: boolean) => {
    setSalvando(lead.id);
    try {
      await onToggleContacted(lead, contatado);
    } finally {
      setSalvando(null);
    }
  };

  if (!leads.length) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium">Nenhum lead neste período</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads aparecem aqui quando alguém informa o WhatsApp no quiz.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44px]">
              <span className="sr-only">Contatado</span>
            </TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="hidden md:table-cell">Origem</TableHead>
            <TableHead className="hidden sm:table-cell">Chegou</TableHead>
            <TableHead className="w-[132px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {leads.map((lead) => {
            const contatado = lead.status !== "NOVO";
            const temp = temperatura(lead.created_at);

            return (
              <TableRow
                key={lead.id}
                className={`cursor-pointer ${contatado ? "opacity-60" : ""}`}
                onClick={() => onOpen(lead)}
              >
                {/* O check é a ação mais repetida do dia — fica na primeira
                    coluna, com área de clique própria e sem abrir o detalhe. */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={contatado}
                    disabled={salvando === lead.id}
                    onCheckedChange={(v) => alternarContato(lead, v === true)}
                    aria-label={contatado ? "Desmarcar contato" : "Marcar como contatado"}
                  />
                </TableCell>

                <TableCell>
                  <div className="flex items-start gap-2.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${temp.classe}`}
                          aria-label={temp.rotulo}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{temp.rotulo}</TooltipContent>
                    </Tooltip>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium tabular-nums">
                          {formatPhone(lead.phone)}
                        </span>

                        {/* O dado mais valioso da linha ganha a cor isolada:
                            "lead novo" e "contato que voltou" pedem conversas
                            completamente diferentes. */}
                        {lead.contact ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          >
                            <Star className="size-3" aria-hidden />
                            Contato
                            {lead.contact.orders_count > 0
                              ? ` · ${lead.contact.orders_count} ${lead.contact.orders_count === 1 ? "pedido" : "pedidos"}`
                              : ""}
                          </Badge>
                        ) : null}

                        {lead.submissions > 1 ? (
                          <Badge variant="secondary" className="gap-1">
                            <Repeat2 className="size-3" aria-hidden />
                            voltou {lead.submissions}x
                          </Badge>
                        ) : null}
                      </div>

                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {lead.contact?.name ? (
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="size-3" aria-hidden />
                            {lead.contact.name}
                            {lead.contact.city ? ` · ${lead.contact.city}/${lead.contact.state ?? ""}` : ""}
                          </span>
                        ) : (
                          "Sem cadastro — só o WhatsApp"
                        )}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {lead.utm_campaign ?? lead.source}
                    {lead.lead_ref ? ` · ref ${lead.lead_ref}` : ""}
                  </span>
                </TableCell>

                <TableCell className="hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(lead.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </TableCell>

                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copiarNumero(lead)}
                          aria-label="Copiar número"
                        >
                          {copiado === lead.id ? (
                            <Check className="size-4 text-emerald-600" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar número</TooltipContent>
                    </Tooltip>

                    {/* Ação de 90% dos casos: maior, colorida e na borda —
                        o alvo mais fácil de acertar da linha. */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                          asChild
                        >
                          <a
                            href={`https://wa.me/${lead.phone}?text=${encodeURIComponent(mensagemWhatsApp(lead))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="size-4" aria-hidden />
                            <span className="sr-only sm:not-sr-only">Falar</span>
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Abrir conversa no WhatsApp</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
