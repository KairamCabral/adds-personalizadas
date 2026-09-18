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
  MessageCircle,
  Pencil,
  Phone,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, formatPhoneInput, maskPhone } from "@/lib/utils";
import {
  searchGiftForRedeem,
  redeemGift,
  issueGiftConfirmCode,
  updateRegistrationPhone,
  PHONE_SEARCH_LIMIT,
  type RedeemSearchResult,
} from "@/services/congressos-gifts.service";
import { classifyRedeemOutcome } from "@/lib/congressos/redeem-outcome";
import {
  buildGiftCodeMessage,
  buildGiftCodeWaUrl,
  isPhoneComplete,
  isValidConfirmCode,
  sanitizeConfirmCode,
} from "@/lib/congressos/confirm-code";
import {
  brMobileError,
  phoneIssueMessage,
  validateBrMobile,
} from "@/lib/congressos/phone-br";

interface RedeemConsoleProps {
  editionId: string;
  editionName: string;
  giftName: string | null;
}

interface SessionEntry {
  name: string;
  shortCode: string;
  at: string; // HH:mm
  comCodigo: boolean;
}

/** Código emitido para o participante ativo (vive só enquanto o card está aberto). */
interface IssuedCode {
  code: string;
  phone: string;
  waUrl: string | null;
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

  // Confirmação por WhatsApp do participante ativo
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [askNoCode, setAskNoCode] = useState(false);

  // Correção de telefone
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [tinyWarning, setTinyWarning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const focusInput = () => inputRef.current?.focus();

  // Refoca o campo ao trocar de edição (tablet no estande).
  useEffect(() => {
    setQuery("");
    setResults([]);
    setActive(null);
    setSearched(false);
    focusInput();
  }, [editionId]);

  /** Zera tudo que é específico do participante ao trocar de card. */
  const resetConfirmState = () => {
    setIssued(null);
    setIssuing(false);
    setTypedCode("");
    setEditingPhone(false);
    setPhoneDraft("");
    setSavingPhone(false);
    setTinyWarning(false);
    setAskNoCode(false);
  };

  const selectActive = (r: RedeemSearchResult | null) => {
    resetConfirmState();
    setActive(r);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearched(false);
    selectActive(null);
    try {
      const found = await searchGiftForRedeem(editionId, q);
      setResults(found);
      setSearched(true);
      if (found.length === 1) selectActive(found[0]);
    } catch {
      toast.error("Não foi possível buscar agora. Tente de novo.");
    } finally {
      setSearching(false);
    }
  };

  const resetForNext = () => {
    setQuery("");
    setResults([]);
    selectActive(null);
    setSearched(false);
    focusInput();
  };

  const handleIssueCode = async () => {
    if (!active || issuing) return;
    setIssuing(true);
    try {
      const res = await issueGiftConfirmCode(active.token);
      if (!res?.success || !res.code) {
        if (res?.outcome === "SEM_TELEFONE") {
          toast.error("Sem telefone no cadastro", {
            description: "Corrija o número ao lado para poder enviar o código.",
          });
          setEditingPhone(true);
          setPhoneDraft(formatPhoneInput(active.phone ?? ""));
        } else {
          const fb = classifyRedeemOutcome(res?.outcome);
          toast.error(fb.title, { description: fb.description });
        }
        return;
      }
      const message = buildGiftCodeMessage({
        participantName: res.participant_name ?? active.name,
        editionName: res.edition_name ?? editionName,
        giftName: res.gift_name ?? giftName,
        code: res.code,
      });
      setIssued({
        code: res.code,
        phone: res.phone ?? active.phone ?? "",
        waUrl: buildGiftCodeWaUrl(res.phone ?? active.phone, message),
      });
      setTypedCode("");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      // O motivo real importa no balcão: sem ele o operador não sabe se é
      // conexão, permissão ou banco — e eu não consigo diagnosticar remoto.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[congressos/retirada] issue_gift_confirm_code:", msg);
      toast.error("Não foi possível gerar o código", { description: msg });
    } finally {
      setIssuing(false);
    }
  };

  const handleSavePhone = async () => {
    if (!active || savingPhone) return;
    const check = validateBrMobile(phoneDraft);
    if (!check.ok) {
      toast.error("Telefone inválido", {
        description: phoneIssueMessage(check.reason),
      });
      return;
    }
    setSavingPhone(true);
    try {
      const res = await updateRegistrationPhone(
        active.registration_id,
        phoneDraft
      );
      // O código vigente foi para o número antigo — a rota já o invalidou.
      setIssued(null);
      setTypedCode("");
      setActive({ ...active, phone: res.phone });
      setResults((rs) =>
        rs.map((r) =>
          r.registration_id === active.registration_id
            ? { ...r, phone: res.phone }
            : r
        )
      );
      setEditingPhone(false);
      setTinyWarning(res.tinyAlreadySynced);
      toast.success("Telefone atualizado.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar o telefone."
      );
    } finally {
      setSavingPhone(false);
    }
  };

  const handleRedeem = async (r: RedeemSearchResult, confirmCode?: string) => {
    if (redeeming) return;
    setRedeeming(true);
    try {
      const res = await redeemGift(r.token, confirmCode ?? null);
      const fb = classifyRedeemOutcome(res?.outcome);
      if (res?.success) {
        const comCodigo = res.verification === "CODIGO";
        toast.success(fb.title, {
          description: `${r.name ?? "Participante"}${comCodigo ? " · confirmado no WhatsApp" : " · sem confirmação por código"}`,
        });
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
              comCodigo,
            },
            ...log,
          ].slice(0, 8)
        );
        resetForNext();
      } else if (res?.outcome === "CODIGO_INVALIDO") {
        toast(fb.title, { description: fb.description });
        setTypedCode("");
        codeRef.current?.focus();
      } else {
        // JA_RETIRADO / CANCELADO / NAO_ENCONTRADO / SEM_PERMISSAO
        if (fb.tone === "warning")
          toast(fb.title, { description: fb.description });
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
              placeholder="Telefone (pode ser só o começo), CPF ou nome"
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
            issuing={issuing}
            issued={issued}
            typedCode={typedCode}
            codeRef={codeRef}
            editingPhone={editingPhone}
            phoneDraft={phoneDraft}
            savingPhone={savingPhone}
            tinyWarning={tinyWarning}
            onTypedCodeChange={(v) => setTypedCode(sanitizeConfirmCode(v))}
            onIssueCode={handleIssueCode}
            onStartEditPhone={() => {
              setPhoneDraft(formatPhoneInput(active.phone ?? ""));
              setEditingPhone(true);
            }}
            onPhoneDraftChange={(v) => setPhoneDraft(formatPhoneInput(v))}
            onCancelEditPhone={() => setEditingPhone(false)}
            onSavePhone={handleSavePhone}
            onRedeemWithCode={() => handleRedeem(active, typedCode)}
            onAskNoCode={() => setAskNoCode(true)}
          />
        )}

        {/* Vários resultados (busca por nome/telefone) → escolher */}
        {!active && results.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {results.length >= PHONE_SEARCH_LIMIT
                ? `Mostrando os ${results.length} primeiros — digite mais números para refinar, ou selecione:`
                : `${results.length} participantes encontrados — selecione:`}
            </p>
            {results.map((r) => (
              <button
                key={r.token}
                type="button"
                onClick={() => selectActive(r)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-secondary/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {maskDoc(r.document)} · código {r.short_code}
                    {r.phone ? ` · ${maskPhone(r.phone)}` : ""}
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
              Confira o telefone, o CPF ou o nome e tente novamente.
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
                  <p className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    {s.shortCode}
                    {s.comCodigo ? (
                      <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ShieldOff className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    )}
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

      <AlertDialog open={askNoCode} onOpenChange={setAskNoCode}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entregar sem confirmação?</AlertDialogTitle>
            <AlertDialogDescription>
              O participante não confirmou o código enviado pelo WhatsApp. A
              entrega pode ser feita assim mesmo, mas fica registrada como{" "}
              <strong>sem confirmação</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAskNoCode(false);
                if (active) void handleRedeem(active);
              }}
            >
              Entregar assim mesmo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

interface ResultCardProps {
  result: RedeemSearchResult;
  giftName: string | null;
  redeeming: boolean;
  issuing: boolean;
  issued: IssuedCode | null;
  typedCode: string;
  codeRef: React.RefObject<HTMLInputElement | null>;
  editingPhone: boolean;
  phoneDraft: string;
  savingPhone: boolean;
  tinyWarning: boolean;
  onTypedCodeChange: (v: string) => void;
  onIssueCode: () => void;
  onStartEditPhone: () => void;
  onPhoneDraftChange: (v: string) => void;
  onCancelEditPhone: () => void;
  onSavePhone: () => void;
  onRedeemWithCode: () => void;
  onAskNoCode: () => void;
}

function ResultCard({
  result,
  giftName,
  redeeming,
  issuing,
  issued,
  typedCode,
  codeRef,
  editingPhone,
  phoneDraft,
  savingPhone,
  tinyWarning,
  onTypedCodeChange,
  onIssueCode,
  onStartEditPhone,
  onPhoneDraftChange,
  onCancelEditPhone,
  onSavePhone,
  onRedeemWithCode,
  onAskNoCode,
}: ResultCardProps) {
  const pendente = result.status === "PENDENTE";
  const retirado = result.status === "RETIRADO";
  const cancelado = result.status === "CANCELADO";

  const temTelefone = isPhoneComplete(result.phone);
  const codigoOk = isValidConfirmCode(typedCode);
  // Cadastro antigo pode ter fixo ou número fora da regra atual: mostrar o que
  // está lá e dizer o que há de errado é mais útil que rotular "Sem telefone".
  const telefoneRuim = !temTelefone && !!result.phone?.trim();
  const motivoTelefone = telefoneRuim ? brMobileError(result.phone) : null;

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

      {pendente && (
        <div className="mt-5 rounded-xl border bg-background/70 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" />
            Confirmação por WhatsApp
          </p>

          {/* Telefone: exibição + edição inline */}
          <div className="mt-3">
            {editingPhone ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={phoneDraft}
                  onChange={(e) => onPhoneDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSavePhone();
                    }
                    if (e.key === "Escape") onCancelEditPhone();
                  }}
                  placeholder="(11) 91234-5678"
                  inputMode="numeric"
                  autoFocus
                  className="h-10 w-[180px] text-base"
                />
                <Button
                  size="sm"
                  onClick={onSavePhone}
                  disabled={savingPhone || !isPhoneComplete(phoneDraft)}
                >
                  {savingPhone ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancelEditPhone}
                  disabled={savingPhone}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span
                  className={cn(
                    "text-base font-semibold tabular-nums",
                    !temTelefone && "text-muted-foreground"
                  )}
                >
                  {result.phone?.trim()
                    ? maskPhone(result.phone)
                    : "Sem telefone"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 px-2 text-xs"
                  onClick={onStartEditPhone}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {temTelefone ? "Editar" : "Informar"}
                </Button>
              </div>
            )}
          </div>

          {motivoTelefone && !editingPhone && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {motivoTelefone} Corrija para poder enviar o código.
            </p>
          )}

          {tinyWarning && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Este contato já foi sincronizado com o Tiny — ajuste o número por
              lá também.
            </p>
          )}

          {/* Estado A: ainda não gerou código */}
          {!issued && (
            <Button
              variant="outline"
              className="mt-4 h-11 w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              onClick={onIssueCode}
              disabled={issuing || !temTelefone || editingPhone}
            >
              {issuing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Enviar código no WhatsApp
            </Button>
          )}

          {/* Estado B: código gerado — abrir conversa + conferir */}
          {issued && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Código gerado:
                </span>
                <span className="rounded-lg bg-muted px-3 py-1 font-mono text-lg font-bold tracking-[0.3em]">
                  {issued.code}
                </span>
              </div>

              {issued.waUrl ? (
                <a
                  href={issued.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  Abrir WhatsApp com {maskPhone(issued.phone)}
                </a>
              ) : (
                <p className="text-xs text-destructive">
                  Telefone inválido para o WhatsApp — corrija o número acima.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="confirm-code"
                  className="text-xs text-muted-foreground"
                >
                  Código informado pelo participante:
                </label>
                <Input
                  id="confirm-code"
                  ref={codeRef}
                  value={typedCode}
                  onChange={(e) => onTypedCodeChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && codigoOk && !redeeming) {
                      e.preventDefault();
                      onRedeemWithCode();
                    }
                  }}
                  placeholder="0000"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-11 w-[110px] text-center font-mono text-lg tracking-[0.3em]"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={onIssueCode}
                  disabled={issuing}
                >
                  Reenviar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        {pendente && (
          <div className="space-y-2">
            <Button
              size="lg"
              className="h-14 w-full text-base"
              onClick={onRedeemWithCode}
              disabled={redeeming || !codigoOk}
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
            <div className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
              <span>
                {issued
                  ? "Participante não recebeu o código?"
                  : "Sem WhatsApp na mão?"}
              </span>
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={onAskNoCode}
                disabled={redeeming}
              >
                Entregar sem confirmação
              </Button>
            </div>
          </div>
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
