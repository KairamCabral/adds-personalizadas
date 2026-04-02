"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CheckCircle2,
  Check,
  Pencil,
  ArrowLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Layers,
  ChevronLeft,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArtViewer } from "./art-viewer";
import { cn } from "@/lib/utils";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const approveSchema = z.object({
  approverName: z.string().min(1, "Informe seu nome"),
});

const revisionSchema = z.object({
  approverName: z.string().min(1, "Informe seu nome"),
  feedback: z.string().min(5, "Descreva o ajuste necessário (mínimo 5 caracteres)"),
});

type ApproveData = z.infer<typeof approveSchema>;
type RevisionData = z.infer<typeof revisionSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtworkVariation {
  id: string;
  url: string;
  variationIndex: number;
  label: string | null;
  status: string;
}

interface ApprovalFormProps {
  token: string;
  orderTitle: string;
  variations: ArtworkVariation[];
  isBundle: boolean;
}

type VariationStep = "view" | "approve" | "revision";

// Bundle decision for one artwork
interface BundleDecision {
  artworkId: string;
  approved: boolean;
  feedback?: string;
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export function ApprovalForm({ token, orderTitle, variations, isBundle }: ApprovalFormProps) {
  // Warn before closing if not yet submitted
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (submitted) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitted]);

  if (isBundle) {
    return (
      <BundleApprovalForm
        token={token}
        orderTitle={orderTitle}
        variations={variations}
        onSubmitted={() => setSubmitted(true)}
      />
    );
  }

  return (
    <VariationApprovalForm
      token={token}
      orderTitle={orderTitle}
      variations={variations}
      onSubmitted={() => setSubmitted(true)}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUNDLE FLOW  (Cenário 2 — múltiplas artes independentes)
// ═══════════════════════════════════════════════════════════════════════════════

type BundleStep = "list" | "artwork" | "confirm" | "success";

function BundleApprovalForm({
  token,
  orderTitle,
  variations,
  onSubmitted,
}: {
  token: string;
  orderTitle: string;
  variations: ArtworkVariation[];
  onSubmitted: () => void;
}) {
  const [bundleStep, setBundleStep] = useState<BundleStep>("list");
  const [currentIdx, setCurrentIdx] = useState(0);
  // Per-artwork sub-step within "artwork" bundle step
  const [artworkSubStep, setArtworkSubStep] = useState<"view" | "decide">("view");
  const [decisions, setDecisions] = useState<Record<string, BundleDecision>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [approverName, setApproverName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const total = variations.length;
  const decidedCount = Object.keys(decisions).length;
  const allDecided = decidedCount === total;

  function openArtwork(idx: number) {
    setCurrentIdx(idx);
    setArtworkSubStep("view");
    setBundleStep("artwork");
  }

  function handleDecide(artworkId: string, approved: boolean, feedback?: string) {
    setDecisions((prev) => ({ ...prev, [artworkId]: { artworkId, approved, feedback } }));
    // Return to list
    setBundleStep("list");
  }

  function handleChangeDecision(artworkId: string) {
    const idx = variations.findIndex((v) => v.id === artworkId);
    if (idx >= 0) openArtwork(idx);
  }

  async function submitAll() {
    if (!approverName.trim()) { setNameError("Informe seu nome"); return; }
    setNameError(null);
    setIsLoading(true);
    setApiError(null);
    try {
      const decisionsArr = Object.values(decisions);
      const res = await fetch("/api/art/approve-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, approver_name: approverName.trim(), decisions: decisionsArr }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao processar");
      onSubmitted();
      setBundleStep("success");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Erro ao processar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  if (bundleStep === "success") return <BundleSuccessScreen decisions={decisions} variations={variations} />;

  if (bundleStep === "artwork") {
    const variation = variations[currentIdx];
    const existingDecision = decisions[variation.id];
    return (
      <BundleArtworkStep
        variation={variation}
        artworkIdx={currentIdx}
        total={total}
        orderTitle={orderTitle}
        subStep={artworkSubStep}
        existingDecision={existingDecision}
        onSubStep={setArtworkSubStep}
        onDecide={handleDecide}
        onBack={() => setBundleStep("list")}
      />
    );
  }

  if (bundleStep === "confirm") {
    return (
      <BundleConfirmStep
        variations={variations}
        decisions={decisions}
        orderTitle={orderTitle}
        approverName={approverName}
        nameError={nameError}
        isLoading={isLoading}
        apiError={apiError}
        onApproverNameChange={setApproverName}
        onChangeDecision={handleChangeDecision}
        onBack={() => setBundleStep("list")}
        onSubmit={submitAll}
      />
    );
  }

  // "list" step
  return (
    <BundleListStep
      variations={variations}
      decisions={decisions}
      orderTitle={orderTitle}
      allDecided={allDecided}
      decidedCount={decidedCount}
      total={total}
      onOpenArtwork={openArtwork}
      onConfirm={() => setBundleStep("confirm")}
    />
  );
}

// Bundle: list of all artworks with their decision status
function BundleListStep({
  variations, decisions, orderTitle, allDecided, decidedCount, total, onOpenArtwork, onConfirm,
}: {
  variations: ArtworkVariation[];
  decisions: Record<string, BundleDecision>;
  orderTitle: string;
  allDecided: boolean;
  decidedCount: number;
  total: number;
  onOpenArtwork: (idx: number) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="animate-in fade-in duration-300 space-y-5">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Aprovação de Artes
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">Pedido: {orderTitle}</p>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Progresso</span>
          <span className={cn("font-semibold", allDecided ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
            {decidedCount}/{total} revisadas
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-500", allDecided ? "bg-emerald-500" : "bg-amber-500")}
            style={{ width: `${(decidedCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Artwork cards */}
      <div className="space-y-3">
        {variations.map((v, idx) => {
          const decision = decisions[v.id];
          const isPending = !decision;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onOpenArtwork(idx)}
              className={cn(
                "w-full rounded-xl border-2 p-4 text-left transition-all hover:shadow-md active:scale-[0.99]",
                isPending
                  ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70"
                  : decision.approved
                  ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70"
                  : "border-[#f07d00]/40 bg-[#f07d00]/5 hover:border-[#f07d00]/70"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    isPending ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                    decision.approved ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                    "bg-[#f07d00]/20 text-[#f07d00]"
                  )}>
                    {isPending ? <Clock className="h-4 w-4" /> : decision.approved ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {v.label || `Arte ${idx + 1}`}
                    </p>
                    <p className={cn("text-xs", isPending ? "text-amber-600 dark:text-amber-400" : decision.approved ? "text-emerald-600 dark:text-emerald-400" : "text-[#f07d00]")}>
                      {isPending ? "Pendente — clique para revisar" : decision.approved ? "Aprovada" : "Ajuste solicitado"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>

      {allDecided ? (
        <Button
          size="lg"
          className="h-14 w-full gap-2 bg-emerald-600 text-base font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-[0.98]"
          onClick={onConfirm}
        >
          <Check className="h-5 w-5" />
          Revisar e confirmar decisões
          <ChevronRight className="ml-auto h-4 w-4" />
        </Button>
      ) : (
        <p className="text-center text-sm text-amber-600 dark:text-amber-400">
          Revise todas as artes para continuar ({total - decidedCount} pendente{total - decidedCount !== 1 ? "s" : ""})
        </p>
      )}
    </div>
  );
}

// Bundle: viewing + deciding on one artwork
function BundleArtworkStep({
  variation, artworkIdx, total, orderTitle, subStep, existingDecision,
  onSubStep, onDecide, onBack,
}: {
  variation: ArtworkVariation;
  artworkIdx: number;
  total: number;
  orderTitle: string;
  subStep: "view" | "decide";
  existingDecision?: BundleDecision;
  onSubStep: (s: "view" | "decide") => void;
  onDecide: (artworkId: string, approved: boolean, feedback?: string) => void;
  onBack: () => void;
}) {
  const [chosenDecision, setChosenDecision] = useState<"approve" | "revision" | null>(
    existingDecision ? (existingDecision.approved ? "approve" : "revision") : null
  );
  const [feedback, setFeedback] = useState(existingDecision?.feedback ?? "");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  function handleChoose(d: "approve" | "revision") {
    setChosenDecision(d);
    onSubStep("decide");
  }

  function handleConfirm() {
    if (chosenDecision === "revision") {
      if (!feedback.trim() || feedback.trim().length < 5) {
        setFeedbackError("Descreva o ajuste necessário (mínimo 5 caracteres)");
        return;
      }
    }
    setFeedbackError(null);
    onDecide(variation.id, chosenDecision === "approve", feedback.trim() || undefined);
  }

  const label = variation.label || `Arte ${artworkIdx + 1}`;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">{label}</h1>
          <p className="text-sm text-muted-foreground">Arte {artworkIdx + 1} de {total} · {orderTitle}</p>
        </div>
      </div>

      {/* Art viewer */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <ArtViewer imageUrl={variation.url} title={label} variationLabel={label} />
      </div>

      {/* Decision sub-step */}
      {subStep === "view" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button size="lg" className="h-14 gap-2 bg-emerald-600 text-base font-semibold hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
            onClick={() => handleChoose("approve")}>
            <Check className="h-5 w-5" />
            Aprovar esta arte
            <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
          </Button>
          <Button size="lg" variant="outline" className="h-14 gap-2 border-2 border-[#f07d00]/50 text-base font-semibold text-[#f07d00] hover:border-[#f07d00] hover:bg-[#f07d00]/10 active:scale-[0.98]"
            onClick={() => handleChoose("revision")}>
            <Pencil className="h-5 w-5" />
            Solicitar ajuste
            <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
          </Button>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-right-4 duration-200 space-y-4 rounded-xl border border-border bg-card p-4">
          {chosenDecision === "approve" ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Aprovando: {label}</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Confirme para registrar a aprovação desta arte.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-[#f07d00]/30 bg-[#f07d00]/8 px-4 py-3">
                <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-[#f07d00]" />
                <div>
                  <p className="text-sm font-semibold text-[#c4600a] dark:text-[#f4a55a]">Ajuste em: {label}</p>
                  <p className="text-xs text-[#c4600a]/80 dark:text-[#f4a55a]/80">Descreva o que precisa ser alterado nesta arte.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bundle-feedback">O que precisa ser ajustado? <span className="text-destructive">*</span></Label>
                <Textarea
                  id="bundle-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ex: Mudar a cor do texto, aumentar a logo..."
                  rows={3}
                  className="resize-none text-base"
                />
                {feedbackError && <p className="text-xs text-destructive">{feedbackError}</p>}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onSubStep("view")}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn("flex-1", chosenDecision === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#f07d00] hover:bg-[#d96e00]")}
              onClick={handleConfirm}
            >
              {chosenDecision === "approve" ? (
                <><Check className="mr-2 h-4 w-4" /> Confirmar aprovação</>
              ) : (
                <><Pencil className="mr-2 h-4 w-4" /> Confirmar ajuste</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Bundle: summary + name + final submit
function BundleConfirmStep({
  variations, decisions, orderTitle, approverName, nameError,
  isLoading, apiError, onApproverNameChange, onChangeDecision, onBack, onSubmit,
}: {
  variations: ArtworkVariation[];
  decisions: Record<string, BundleDecision>;
  orderTitle: string;
  approverName: string;
  nameError: string | null;
  isLoading: boolean;
  apiError: string | null;
  onApproverNameChange: (v: string) => void;
  onChangeDecision: (artworkId: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { const t = setTimeout(() => nameRef.current?.focus(), 50); return () => clearTimeout(t); }, []);
  const approvedCount = Object.values(decisions).filter((d) => d.approved).length;
  const revisionCount = Object.values(decisions).filter((d) => !d.approved).length;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} disabled={isLoading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
          aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Confirmar decisões</h1>
          <p className="text-sm text-muted-foreground">Pedido: {orderTitle}</p>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {approvedCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" /> {approvedCount} aprovada{approvedCount !== 1 ? "s" : ""}
          </span>
        )}
        {revisionCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-[#f07d00]/15 px-3 py-1.5 text-sm font-medium text-[#f07d00]">
            <Pencil className="h-3.5 w-3.5" /> {revisionCount} com ajuste
          </span>
        )}
      </div>

      {/* Decisions list */}
      <div className="space-y-2">
        {variations.map((v, idx) => {
          const d = decisions[v.id];
          return (
            <div key={v.id} className={cn(
              "flex items-start justify-between gap-3 rounded-xl border p-3",
              d.approved ? "border-emerald-500/30 bg-emerald-500/5" : "border-[#f07d00]/30 bg-[#f07d00]/5"
            )}>
              <div className="flex items-start gap-2 min-w-0">
                {d.approved
                  ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  : <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-[#f07d00]" />}
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{v.label || `Arte ${idx + 1}`}</p>
                  {!d.approved && d.feedback && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">&ldquo;{d.feedback}&rdquo;</p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => onChangeDecision(v.id)} disabled={isLoading}
                className="shrink-0 flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40">
                <RotateCcw className="h-3 w-3" /> Alterar
              </button>
            </div>
          );
        })}
      </div>

      {/* Pending warning */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Decisões ainda não enviadas</p>
          <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/70">Informe seu nome abaixo e confirme para registrar todas as decisões.</p>
        </div>
      </div>

      {/* Name field */}
      <div className="space-y-1.5">
        <Label htmlFor="bundle-approver-name" className="text-sm font-semibold">
          Seu nome completo <span className="text-destructive">*</span>
        </Label>
        <Input
          id="bundle-approver-name"
          value={approverName}
          onChange={(e) => onApproverNameChange(e.target.value)}
          placeholder="Ex: Maria da Silva"
          className="h-12 text-base ring-2 ring-emerald-500/30 focus:ring-emerald-500/60"
          disabled={isLoading}
          ref={nameRef}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        {!nameError && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3 shrink-0" />
            Sem confirmar, suas decisões não serão registradas.
          </p>
        )}
      </div>

      {apiError && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{apiError}</p>
      )}

      <Button type="button" size="lg" disabled={isLoading} onClick={onSubmit}
        className="h-14 w-full animate-pulse gap-2 bg-emerald-600 text-base font-bold shadow-lg shadow-emerald-500/30 hover:animate-none hover:bg-emerald-700 active:scale-[0.98] disabled:animate-none disabled:opacity-60">
        {isLoading ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Registrando...</>
        ) : (
          <><Check className="h-5 w-5" /> Confirmar todas as decisões</>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Leva menos de 10 segundos · Você pode alterar qualquer decisão antes de confirmar
      </p>
    </div>
  );
}

// Bundle success screen
function BundleSuccessScreen({ decisions, variations }: { decisions: Record<string, BundleDecision>; variations: ArtworkVariation[] }) {
  const approvedCount = Object.values(decisions).filter((d) => d.approved).length;
  const revisionCount = Object.values(decisions).filter((d) => !d.approved).length;
  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-xl sm:p-12">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15 shadow-lg shadow-emerald-500/20">
        <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Decisões registradas!</h2>
        <p className="mt-2 text-base text-muted-foreground">A equipe ADDS foi notificada e já está trabalhando.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {approvedCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> {approvedCount} arte{approvedCount !== 1 ? "s" : ""} aprovada{approvedCount !== 1 ? "s" : ""}
          </span>
        )}
        {revisionCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-[#f07d00]/15 px-4 py-2 text-sm font-semibold text-[#f07d00]">
            <Pencil className="h-4 w-4" /> {revisionCount} com ajuste solicitado
          </span>
        )}
      </div>
      <div className="space-y-2 text-left">
        {variations.map((v, idx) => {
          const d = decisions[v.id];
          return (
            <div key={v.id} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", d.approved ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-[#f07d00]/10 text-[#c4600a] dark:text-[#f4a55a]")}>
              {d.approved ? <Check className="h-4 w-4 shrink-0" /> : <Pencil className="h-4 w-4 shrink-0" />}
              <span className="font-medium">{v.label || `Arte ${idx + 1}`}</span>
              <span className="ml-auto text-xs opacity-80">{d.approved ? "Aprovada" : "Ajuste solicitado"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIATION FLOW  (Cenário 1 — escolha uma variação com ajuste individual)
// ═══════════════════════════════════════════════════════════════════════════════

function VariationApprovalForm({
  token, orderTitle, variations, onSubmitted,
}: {
  token: string;
  orderTitle: string;
  variations: ArtworkVariation[];
  onSubmitted: () => void;
}) {
  const hasMultiple = variations.length > 1;
  const [step, setStep] = useState<VariationStep>("view");
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(
    hasMultiple ? null : (variations[0]?.id ?? null)
  );
  // For revision: which specific artwork to adjust (null = all of same version)
  const [revisionArtworkId, setRevisionArtworkId] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successType, setSuccessType] = useState<"approve" | "revision">("approve");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function goToApprove(variationId?: string) {
    if (variationId) setSelectedVariationId(variationId);
    setApiError(null);
    setStep("approve");
  }

  function goToRevision(artworkId?: string) {
    setRevisionArtworkId(artworkId ?? null);
    setApiError(null);
    setStep("revision");
  }

  async function submit(payload: {
    approved: boolean;
    approver_name: string;
    feedback?: string;
    approved_artwork_id?: string;
    adjusted_artwork_id?: string;
  }) {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/art/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao processar");
      setSuccessType(payload.approved ? "approve" : "revision");
      onSubmitted();
      setIsSuccess(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Erro ao processar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) return <SuccessScreen type={successType} />;

  if (step === "view") {
    return (
      <ViewStep
        orderTitle={orderTitle}
        variations={variations}
        hasMultiple={hasMultiple}
        onApprove={goToApprove}
        onRevision={goToRevision}
      />
    );
  }

  if (step === "approve") {
    return (
      <ApproveStep
        orderTitle={orderTitle}
        variations={variations}
        selectedVariationId={selectedVariationId}
        hasMultiple={hasMultiple}
        isLoading={isLoading}
        apiError={apiError}
        onBack={() => setStep("view")}
        onSubmit={(data) =>
          submit({ approved: true, approver_name: data.approverName, approved_artwork_id: selectedVariationId ?? undefined })
        }
      />
    );
  }

  return (
    <RevisionStep
      orderTitle={orderTitle}
      revisionArtworkId={revisionArtworkId}
      variations={variations}
      isLoading={isLoading}
      apiError={apiError}
      onBack={() => setStep("view")}
      onSubmit={(data) =>
        submit({
          approved: false,
          approver_name: data.approverName,
          feedback: data.feedback,
          adjusted_artwork_id: revisionArtworkId ?? undefined,
        })
      }
    />
  );
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessScreen({ type }: { type: "approve" | "revision" }) {
  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-xl ring-1 ring-border/50 sm:p-12">
      <div className={cn("mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full shadow-lg",
        type === "approve" ? "bg-emerald-500/15 shadow-emerald-500/20" : "bg-amber-500/15 shadow-amber-500/20")}>
        {type === "approve"
          ? <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
          : <Pencil className="h-12 w-12 text-amber-600 dark:text-amber-400" />}
      </div>
      <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
        {type === "approve" ? "Arte aprovada!" : "Ajuste solicitado!"}
      </h2>
      <p className="mt-3 max-w-sm text-base text-muted-foreground">
        {type === "approve"
          ? "Ótimo! A equipe ADDS já foi notificada e sua arte seguirá para produção."
          : "Recebemos seu pedido. A equipe ADDS fará os ajustes e enviará uma nova versão em breve."}
      </p>
    </div>
  );
}

// ─── View Step ────────────────────────────────────────────────────────────────

function ViewStep({
  orderTitle, variations, hasMultiple, onApprove, onRevision,
}: {
  orderTitle: string;
  variations: ArtworkVariation[];
  hasMultiple: boolean;
  onApprove: (variationId?: string) => void;
  onRevision: (artworkId?: string) => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-5">
      <div className="space-y-0.5">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Aprovação de Arte</h1>
        <p className="text-sm text-muted-foreground">Pedido: {orderTitle}</p>
      </div>
      <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
        {hasMultiple ? (
          <MultipleVariationsView variations={variations} onApprove={onApprove} onRevision={onRevision} />
        ) : (
          <SingleArtView variation={variations[0]} onApprove={() => onApprove()} onRevision={() => onRevision()} />
        )}
      </div>
    </div>
  );
}

function SingleArtView({
  variation, onApprove, onRevision,
}: {
  variation: ArtworkVariation;
  onApprove: () => void;
  onRevision: () => void;
}) {
  return (
    <div className="space-y-5">
      <ArtViewer imageUrl={variation.url} title="Visualização da arte" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button size="lg"
          className="h-14 gap-2 bg-emerald-600 text-base font-semibold hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] sm:h-16"
          onClick={onApprove}>
          <Check className="h-5 w-5" /> Aprovar Arte <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
        </Button>
        <Button size="lg" variant="outline"
          className="h-14 gap-2 border-2 border-[#f07d00]/50 text-base font-semibold text-[#f07d00] hover:border-[#f07d00] hover:bg-[#f07d00]/10 hover:shadow-lg active:scale-[0.98] sm:h-16"
          onClick={onRevision}>
          <Pencil className="h-5 w-5" /> Solicitar Ajuste <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
        </Button>
      </div>
    </div>
  );
}

function MultipleVariationsView({
  variations, onApprove, onRevision,
}: {
  variations: ArtworkVariation[];
  onApprove: (variationId: string) => void;
  onRevision: (artworkId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">Compare as opções e escolha a que mais gostou:</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {variations.map((v) => (
          <div key={v.id} className="flex flex-col overflow-hidden rounded-xl border-2 border-border bg-card transition-colors hover:border-primary/30">
            <div className="flex-1 p-3">
              <ArtViewer imageUrl={v.url} title={`Opção ${v.variationIndex}`} variationLabel={`Opção ${v.variationIndex}`} />
            </div>
            <div className="space-y-2 border-t border-border bg-muted/20 p-3">
              <Button size="lg"
                className="h-12 w-full gap-2 bg-emerald-600 font-semibold hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-500/20 active:scale-[0.98]"
                onClick={() => onApprove(v.id)}>
                <Check className="h-4 w-4" />
                Aprovar Opção {v.variationIndex}
                <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
              </Button>
              <Button size="sm" variant="outline"
                className="h-9 w-full gap-2 border border-[#f07d00]/40 font-medium text-[#f07d00] hover:border-[#f07d00] hover:bg-[#f07d00]/10 active:scale-[0.98]"
                onClick={() => onRevision(v.id)}>
                <Pencil className="h-3.5 w-3.5" />
                Ajuste na Opção {v.variationIndex}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Approve Step ─────────────────────────────────────────────────────────────

function ApproveStep({
  orderTitle, variations, selectedVariationId, hasMultiple, isLoading, apiError, onBack, onSubmit,
}: {
  orderTitle: string;
  variations: ArtworkVariation[];
  selectedVariationId: string | null;
  hasMultiple: boolean;
  isLoading: boolean;
  apiError: string | null;
  onBack: () => void;
  onSubmit: (data: ApproveData) => void;
}) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  const selectedVariation = hasMultiple ? variations.find((v) => v.id === selectedVariationId) : variations[0];
  const { register, handleSubmit, formState: { errors } } = useForm<ApproveData>({ resolver: zodResolver(approveSchema) });

  useEffect(() => { const t = setTimeout(() => nameRef.current?.focus(), 50); return () => clearTimeout(t); }, []);
  const { ref: rhfRef, ...nameRest } = register("approverName");

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} disabled={isLoading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
            aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Confirmar Aprovação</h1>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">Etapa 2 de 2</span>
            </div>
            <p className="text-sm text-muted-foreground">Pedido: {orderTitle}</p>
          </div>
        </div>
        {/* Progress */}
        <div className="space-y-1.5">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-4 right-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
            <div className="absolute left-4 top-1/2 h-1 w-[calc(90%-2rem)] -translate-y-1/2 rounded-full bg-emerald-500 transition-all duration-700" />
            <div className="relative z-10 flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-500/30 ring-2 ring-background">
                <Check className="h-4 w-4 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Ver arte</span>
            </div>
            <div className="relative z-10 flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-amber-500 shadow-md shadow-amber-500/30 ring-2 ring-background">
                <span className="text-xs font-bold text-white">2</span>
              </div>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Confirmar</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] text-muted-foreground">0%</span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">90% concluído — falta apenas confirmar</span>
            <span className="text-[10px] text-muted-foreground">100%</span>
          </div>
        </div>
      </div>

      {/* Pending alert */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Aprovação pendente — ainda não concluída</p>
          <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/70">
            {hasMultiple && selectedVariation
              ? `Opção ${selectedVariation.variationIndex} escolhida. Confirme abaixo para registrar sua decisão.`
              : "Confirme seu nome abaixo para registrar a aprovação oficialmente."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="approverName" className="text-sm font-semibold">
            Seu nome completo <span className="text-destructive">*</span>
          </Label>
          <Input id="approverName" placeholder="Ex: Maria da Silva"
            className="h-12 text-base ring-2 ring-emerald-500/30 focus:ring-emerald-500/60"
            disabled={isLoading}
            {...nameRest}
            ref={(el) => { rhfRef(el); nameRef.current = el; }}
          />
          {errors.approverName ? (
            <p className="text-xs text-destructive">{errors.approverName.message}</p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Sem confirmar, sua aprovação não será registrada.
            </p>
          )}
        </div>
        {apiError && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{apiError}</p>
        )}
        <Button type="submit" size="lg" disabled={isLoading}
          className="h-14 w-full animate-pulse gap-2 bg-emerald-600 text-base font-bold shadow-lg shadow-emerald-500/30 hover:animate-none hover:bg-emerald-700 hover:shadow-emerald-500/40 active:scale-[0.98] disabled:animate-none disabled:opacity-60">
          {isLoading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Registrando aprovação...</>
          ) : (
            <><Check className="h-5 w-5" /> Confirmar aprovação agora</>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Leva menos de 10 segundos · Você pode voltar e rever a arte a qualquer momento
        </p>
      </form>
    </div>
  );
}

// ─── Revision Step ────────────────────────────────────────────────────────────

function RevisionStep({
  orderTitle, revisionArtworkId, variations, isLoading, apiError, onBack, onSubmit,
}: {
  orderTitle: string;
  revisionArtworkId: string | null;
  variations: ArtworkVariation[];
  isLoading: boolean;
  apiError: string | null;
  onBack: () => void;
  onSubmit: (data: RevisionData) => void;
}) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RevisionData>({ resolver: zodResolver(revisionSchema) });
  const feedback = watch("feedback") ?? "";
  const targetVariation = revisionArtworkId ? variations.find((v) => v.id === revisionArtworkId) : null;

  useEffect(() => { const t = setTimeout(() => nameRef.current?.focus(), 50); return () => clearTimeout(t); }, []);
  const { ref: rhfRef, ...nameRest } = register("approverName");

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} disabled={isLoading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
          aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Solicitar Ajuste</h1>
          <p className="text-sm text-muted-foreground">Pedido: {orderTitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-[#f07d00]/30 bg-[#f07d00]/8 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f07d00]/15">
          <Pencil className="h-5 w-5 text-[#f07d00]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#c4600a] dark:text-[#f4a55a]">
            {targetVariation ? `Ajuste na Opção ${targetVariation.variationIndex}` : "Solicitar ajuste na arte"}
          </p>
          <p className="text-xs text-[#c4600a]/80 dark:text-[#f4a55a]/80">A equipe ADDS fará as alterações e enviará uma nova versão</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="approverName">Seu nome completo <span className="text-destructive">*</span></Label>
          <Input id="approverName" placeholder="Ex: Maria da Silva"
            className="h-12 text-base" disabled={isLoading}
            {...nameRest}
            ref={(el) => { rhfRef(el); nameRef.current = el; }}
          />
          {errors.approverName && <p className="text-xs text-destructive">{errors.approverName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feedback">O que precisa ser ajustado? <span className="text-destructive">*</span></Label>
          <Textarea id="feedback" placeholder="Ex: Aumentar o logo, mudar a cor do fundo para azul..."
            rows={4} className="resize-none text-base" disabled={isLoading}
            {...register("feedback")}
          />
          <div className="flex items-center justify-between">
            {errors.feedback ? (
              <p className="text-xs text-destructive">{errors.feedback.message}</p>
            ) : <span />}
            <p className={cn("text-xs tabular-nums", feedback.trim().length < 5 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
              {feedback.trim().length}/5 mín
            </p>
          </div>
        </div>
        {apiError && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{apiError}</p>
        )}
        <Button type="submit" size="lg" disabled={isLoading}
          className="h-14 w-full gap-2 bg-[#f07d00] text-base font-semibold hover:bg-[#d96e00] hover:shadow-lg hover:shadow-[#f07d00]/20 active:scale-[0.98] disabled:opacity-60">
          {isLoading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Enviando...</>
          ) : (
            <><Pencil className="h-5 w-5" /> Enviar solicitação de ajuste</>
          )}
        </Button>
      </form>
    </div>
  );
}
