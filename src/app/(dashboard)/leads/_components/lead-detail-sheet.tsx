"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Megaphone,
  Repeat2,
  ShoppingBag,
  Star,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  formatPhone,
  saveLeadNotes,
  setLeadStatus,
  type LeadStatus,
  type LeadWithContact,
} from "@/services/leads.service";

interface Props {
  lead: LeadWithContact | null;
  onClose: () => void;
  onChanged: () => void;
}

const ROTULO_STATUS: Record<LeadStatus, string> = {
  NOVO: "Aguardando contato",
  CONTATADO: "Contatado",
  CONVERTIDO: "Convertido",
  DESCARTADO: "Descartado",
};

function mensagemWhatsApp(lead: LeadWithContact): string {
  const primeiroNome = lead.contact?.name?.trim().split(/\s+/)[0];
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  return `${saudacao} Aqui é da ADDS Brasil. Você pediu o orçamento da escova para protocolo ADDS Implant — posso te enviar as condições para dentistas?`;
}

/** Um marco da linha do tempo. `pendente` fica oco, para ler como "ainda não". */
function Marco({
  concluido,
  titulo,
  detalhe,
}: {
  concluido: boolean;
  titulo: string;
  detalhe?: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-1 size-2.5 shrink-0 rounded-full ${
          concluido ? "bg-emerald-500" : "border-2 border-muted-foreground/40"
        }`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={`text-sm ${concluido ? "" : "text-muted-foreground"}`}>{titulo}</p>
        {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
      </div>
    </li>
  );
}

export function LeadDetailSheet({ lead, onClose, onChanged }: Props) {
  const [notas, setNotas] = useState("");
  const [salvandoNotas, setSalvandoNotas] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Recarrega ao trocar de lead — sem isso, abrir um segundo lead mostraria as
  // notas do primeiro.
  useEffect(() => {
    setNotas(lead?.notes ?? "");
    setCopiado(false);
  }, [lead?.id, lead?.notes]);

  if (!lead) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(formatPhone(lead.phone));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
      toast.success("Número copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const mudarStatus = async (status: LeadStatus) => {
    try {
      await setLeadStatus(lead.id, status);
      toast.success(`Marcado como ${ROTULO_STATUS[status].toLowerCase()}`);
      onChanged();
      onClose();
    } catch {
      toast.error("Não foi possível salvar");
    }
  };

  const salvarNotas = async () => {
    setSalvandoNotas(true);
    try {
      await saveLeadNotes(lead.id, notas);
      toast.success("Notas salvas");
      onChanged();
    } catch {
      toast.error("Não foi possível salvar as notas");
    } finally {
      setSalvandoNotas(false);
    }
  };

  const dataChegada = format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <Sheet open={Boolean(lead)} onOpenChange={(aberto) => !aberto && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-3 text-left">
          <div>
            <SheetTitle className="text-xl tabular-nums">{formatPhone(lead.phone)}</SheetTitle>
            {lead.contact?.name ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{lead.contact.name}</p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Sem cadastro no CRM</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant={lead.status === "NOVO" ? "default" : "secondary"}>
              {ROTULO_STATUS[lead.status]}
            </Badge>

            {lead.contact ? (
              <Badge
                variant="secondary"
                className="gap-1 border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                <Star className="size-3" aria-hidden />
                Já é contato
              </Badge>
            ) : null}

            {lead.submissions > 1 ? (
              <Badge variant="secondary" className="gap-1">
                <Repeat2 className="size-3" aria-hidden />
                voltou {lead.submissions}x
              </Badge>
            ) : null}
          </div>

          {/* Ações primárias no topo: a conversa é o objetivo da tela, não uma
              opção escondida no fim de uma lista de campos. */}
          <div className="flex gap-2">
            <Button asChild className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
              <a
                href={`https://wa.me/${lead.phone}?text=${encodeURIComponent(mensagemWhatsApp(lead))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" aria-hidden />
                Falar no WhatsApp
              </a>
            </Button>
            <Button variant="outline" size="icon" onClick={copiar} aria-label="Copiar número">
              {copiado ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </SheetHeader>

        <Separator className="my-5" />

        {/* Bloco de contato: só existe quando há cruzamento. Seção vazia com
            "—" em todo campo ocupa espaço e não informa nada. */}
        {lead.contact ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contato no CRM
            </h3>

            {lead.contact.orders_count > 0 ? (
              <p className="flex items-center gap-2 text-sm">
                <ShoppingBag className="size-4 text-muted-foreground" aria-hidden />
                {lead.contact.orders_count}{" "}
                {lead.contact.orders_count === 1 ? "pedido" : "pedidos"} no histórico
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShoppingBag className="size-4" aria-hidden />
                Cadastrado, mas ainda sem pedidos
              </p>
            )}

            {lead.contact.email ? (
              <p className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                {lead.contact.email}
              </p>
            ) : null}

            {lead.contact.company ? (
              <p className="flex items-center gap-2 text-sm">
                <Building2 className="size-4 text-muted-foreground" aria-hidden />
                {lead.contact.company}
              </p>
            ) : null}

            {lead.contact.city ? (
              <p className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
                {lead.contact.city}
                {lead.contact.state ? `/${lead.contact.state}` : ""}
              </p>
            ) : null}

            <Button variant="link" size="sm" className="h-auto gap-1 p-0" asChild>
              <Link href={`/contacts/${lead.contact.id}`}>
                Abrir contato
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            </Button>
          </section>
        ) : (
          <section className="rounded-lg border border-dashed p-3">
            <p className="text-sm text-muted-foreground">
              Este número ainda não está em Contatos. Se você cadastrar o contato com
              este telefone, o nome aparece aqui automaticamente.
            </p>
          </section>
        )}

        <Separator className="my-5" />

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Linha do tempo
          </h3>
          <ul className="space-y-2.5">
            <Marco concluido titulo="Deixou o WhatsApp no quiz" detalhe={dataChegada} />
            {lead.submissions > 1 ? (
              <Marco
                concluido
                titulo={`Preencheu ${lead.submissions} vezes`}
                detalhe={`Último em ${format(new Date(lead.last_submitted_at), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
              />
            ) : null}
            <Marco
              concluido={Boolean(lead.contacted_at)}
              titulo={lead.contacted_at ? "Contatado pelo time" : "Aguardando contato"}
              detalhe={
                lead.contacted_at
                  ? format(new Date(lead.contacted_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                  : undefined
              }
            />
          </ul>
        </section>

        <Separator className="my-5" />

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Origem
          </h3>
          <p className="flex items-center gap-2 text-sm">
            <Megaphone className="size-4 text-muted-foreground" aria-hidden />
            {lead.utm_campaign ?? lead.source}
          </p>
          {lead.lead_ref ? (
            <p className="text-xs text-muted-foreground">
              Ref <span className="font-mono">{lead.lead_ref}</span> — é o código que aparece
              na mensagem que ele enviou.
            </p>
          ) : null}
        </section>

        <Separator className="my-5" />

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notas
          </h3>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="O que foi conversado, próximo passo, objeções…"
            rows={4}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={salvarNotas}
            disabled={salvandoNotas || notas === (lead.notes ?? "")}
          >
            {salvandoNotas ? "Salvando…" : "Salvar notas"}
          </Button>
        </section>

        <Separator className="my-5" />

        {/* Desfecho por último: são ações de encerramento, e ficar no topo
            convidaria a fechar o lead antes de trabalhá-lo. */}
        <section className="space-y-2 pb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Desfecho
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => mudarStatus("CONVERTIDO")}
              disabled={lead.status === "CONVERTIDO"}
            >
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
              Convertido
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => mudarStatus("DESCARTADO")}
              disabled={lead.status === "DESCARTADO"}
            >
              <XCircle className="size-4 text-muted-foreground" aria-hidden />
              Descartar
            </Button>
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}
