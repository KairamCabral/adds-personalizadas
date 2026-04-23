"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Phone,
  Pencil,
  Check,
  X,
  Copy,
  MessageCircle,
  ChevronDown,
  Loader2,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOrderContact } from "@/services/orders.service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OrderContactCardProps {
  orderId: string;
  contactName: string | null;
  contactPhone: string | null;
  // Optional: pre-fill suggestions from the linked client
  clientName?: string | null;
  clientPhone?: string | null;
  // Optional: tiny_id to fetch contact persons from Tiny
  tinyId?: number | null;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${international}`;
}

// Tiny v3 usa "contatos" e campo "telefone" (não "fone") — ref: BasePessoaContatoModel
interface TinyContactPerson {
  nome?: string | null;
  telefone?: string | null;
  setor?: string | null;
  email?: string | null;
  ramal?: string | null;
}

export function OrderContactCard({
  orderId,
  contactName,
  contactPhone,
  clientName,
  clientPhone,
  tinyId,
}: OrderContactCardProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [nameVal, setNameVal] = useState(contactName ?? "");
  const [phoneVal, setPhoneVal] = useState(contactPhone ?? "");
  const [copied, setCopied] = useState(false);
  const [syncToTiny, setSyncToTiny] = useState(!!tinyId);
  const [showTinyPeople, setShowTinyPeople] = useState(false);
  const [tinyPeople, setTinyPeople] = useState<TinyContactPerson[]>([]);
  const [loadingTiny, setLoadingTiny] = useState(false);
  const [tinySyncStatus, setTinySyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const nameRef = useRef<HTMLInputElement>(null);

  const isEmpty = !contactName && !contactPhone;

  useEffect(() => {
    if (isEditing) {
      setNameVal(contactName ?? "");
      setPhoneVal(contactPhone ?? "");
      setSyncToTiny(!!tinyId);
      setTinySyncStatus("idle");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isEditing, contactName, contactPhone, tinyId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Save to Supabase
      await updateOrderContact(orderId, nameVal, phoneVal);

      // 2. Optionally sync to Tiny
      if (syncToTiny && tinyId && nameVal.trim()) {
        setTinySyncStatus("syncing");
        try {
          // Tiny pessoasContato uses "fone" for phone
          const digits = phoneVal.replace(/\D/g, "");
              const res = await fetch(`/api/tiny/contacts/${tinyId}/contact-persons`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nome: nameVal.trim(),
              telefone: digits || undefined,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error ?? "Falha no Tiny");
          setTinySyncStatus("ok");
        } catch (err) {
          setTinySyncStatus("error");
          toast.warning(
            `Contato salvo no CRM, mas não foi possível sincronizar com o Tiny: ${err instanceof Error ? err.message : "erro desconhecido"}`
          );
          return;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setIsEditing(false);
      if (syncToTiny && tinyId) {
        toast.success("Contato salvo e sincronizado com o Tiny");
      } else {
        toast.success("Contato atualizado");
      }
    },
    onError: () => toast.error("Erro ao salvar contato"),
  });

  function handleCopy() {
    if (!contactPhone) return;
    navigator.clipboard.writeText(contactPhone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleUseClient() {
    setNameVal(clientName ?? "");
    setPhoneVal(clientPhone ?? "");
  }

  async function handleLoadTinyPeople() {
    if (!tinyId) return;
    setLoadingTiny(true);
    try {
      const res = await fetch(`/api/tiny/contacts/${tinyId}/contact-persons`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTinyPeople(data.pessoas ?? []);
      setShowTinyPeople(true);
    } catch {
      toast.error("Não foi possível buscar contatos do Tiny");
    } finally {
      setLoadingTiny(false);
    }
  }

  function handleSelectTinyPerson(p: TinyContactPerson) {
    setNameVal(p.nome ?? "");
    setPhoneVal(p.telefone ?? "");
    setShowTinyPeople(false);
  }

  // ─── Editing mode ──────────────────────────────────────────────────────────

  if (isEditing) {
    return (
      <div className="mt-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Contato do chat
          </p>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input
              ref={nameRef}
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              placeholder="Ex: Maria (recepção)"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Telefone / WhatsApp</label>
            <Input
              value={phoneVal}
              onChange={(e) => setPhoneVal(e.target.value)}
              placeholder="(11) 99000-0000"
              className="h-9 text-sm"
              type="tel"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveMutation.mutate();
                if (e.key === "Escape") setIsEditing(false);
              }}
            />
          </div>
        </div>

        {/* Quick-fill options */}
        <div className="flex flex-wrap gap-2">
          {(clientName || clientPhone) && (
            <button
              type="button"
              onClick={handleUseClient}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Usar dados do cliente
            </button>
          )}
          {tinyId && (
            <button
              type="button"
              onClick={handleLoadTinyPeople}
              disabled={loadingTiny}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
            >
              {loadingTiny
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              Buscar no Tiny
            </button>
          )}
        </div>

        {/* Tiny people dropdown */}
        {showTinyPeople && tinyPeople.length > 0 && (
          <div className="rounded-lg border border-border bg-card shadow-md">
            {tinyPeople.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectTinyPerson(p)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 first:rounded-t-lg last:rounded-b-lg"
              >
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{p.nome}</span>
                {p.setor && <span className="text-xs text-muted-foreground">({p.setor})</span>}
                {p.telefone && (
                  <span className="ml-auto text-xs text-muted-foreground">{p.telefone}</span>
                )}
              </button>
            ))}
          </div>
        )}
        {showTinyPeople && tinyPeople.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma pessoa de contato encontrada no Tiny.</p>
        )}

        {/* Tiny sync option */}
        {tinyId && (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 transition-colors hover:bg-muted/50">
            <input
              type="checkbox"
              checked={syncToTiny}
              onChange={(e) => setSyncToTiny(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              Salvar também nas Pessoas de Contato do Tiny
            </span>
          </label>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Check className="h-4 w-4" />}
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────

  if (isEmpty) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
      >
        <UserPlus className="h-4 w-4 shrink-0" />
        <span>Adicionar contato do chat (nome e telefone)</span>
      </button>
    );
  }

  // ─── Display mode ──────────────────────────────────────────────────────────

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      {/* Info */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 leading-tight">
          {contactName && (
            <p className="truncate text-sm font-semibold text-foreground">{contactName}</p>
          )}
          {contactPhone && (
            <p className={cn("text-xs", contactName ? "text-muted-foreground" : "text-sm font-semibold text-foreground")}>
              <Phone className="mr-1 inline-block h-3 w-3" />
              {formatPhone(contactPhone)}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {contactPhone && (
          <>
            <a
              href={whatsappUrl(contactPhone)}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no WhatsApp"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
            <button
              type="button"
              title="Copiar telefone"
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
        <button
          type="button"
          title="Editar contato"
          onClick={() => setIsEditing(true)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
