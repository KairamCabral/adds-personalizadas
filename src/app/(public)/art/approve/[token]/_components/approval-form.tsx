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
  feedback: z
    .string()
    .min(5, "Descreva o ajuste necessário (mínimo 5 caracteres)"),
});

type ApproveData = z.infer<typeof approveSchema>;
type RevisionData = z.infer<typeof revisionSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtworkVariation {
  id: string;
  url: string;
  variationIndex: number;
}

interface ApprovalFormProps {
  token: string;
  orderTitle: string;
  variations: ArtworkVariation[];
}

type Step = "view" | "approve" | "revision";

// ─── Main component ───────────────────────────────────────────────────────────

export function ApprovalForm({ token, orderTitle, variations }: ApprovalFormProps) {
  const hasMultiple = variations.length > 1;
  const [step, setStep] = useState<Step>("view");
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(
    hasMultiple ? null : (variations[0]?.id ?? null)
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [successType, setSuccessType] = useState<"approve" | "revision">("approve");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function goToApprove(variationId?: string) {
    if (variationId) setSelectedVariationId(variationId);
    setApiError(null);
    setStep("approve");
  }

  function goToRevision() {
    setApiError(null);
    setStep("revision");
  }

  async function submit(payload: {
    approved: boolean;
    approver_name: string;
    feedback?: string;
    approved_artwork_id?: string;
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
      setIsSuccess(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Erro ao processar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <SuccessScreen type={successType} />
    );
  }

  // ── Step: view ─────────────────────────────────────────────────────────────
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

  // ── Step: approve ──────────────────────────────────────────────────────────
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
          submit({
            approved: true,
            approver_name: data.approverName,
            approved_artwork_id: selectedVariationId ?? undefined,
          })
        }
      />
    );
  }

  // ── Step: revision ─────────────────────────────────────────────────────────
  return (
    <RevisionStep
      orderTitle={orderTitle}
      isLoading={isLoading}
      apiError={apiError}
      onBack={() => setStep("view")}
      onSubmit={(data) =>
        submit({
          approved: false,
          approver_name: data.approverName,
          feedback: data.feedback,
        })
      }
    />
  );
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessScreen({ type }: { type: "approve" | "revision" }) {
  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-xl ring-1 ring-border/50 sm:p-12">
      <div
        className={cn(
          "mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full shadow-lg",
          type === "approve"
            ? "bg-emerald-500/15 shadow-emerald-500/20"
            : "bg-amber-500/15 shadow-amber-500/20"
        )}
      >
        {type === "approve" ? (
          <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Pencil className="h-12 w-12 text-amber-600 dark:text-amber-400" />
        )}
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

// ─── Step 1: View ─────────────────────────────────────────────────────────────

function ViewStep({
  orderTitle,
  variations,
  hasMultiple,
  onApprove,
  onRevision,
}: {
  orderTitle: string;
  variations: ArtworkVariation[];
  hasMultiple: boolean;
  onApprove: (variationId?: string) => void;
  onRevision: () => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-5">
      {/* Header */}
      <div className="space-y-0.5">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Aprovação de Arte
        </h1>
        <p className="text-sm text-muted-foreground">Pedido: {orderTitle}</p>
      </div>

      {/* Art viewer */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
        {hasMultiple ? (
          <MultipleVariationsView
            variations={variations}
            onApprove={onApprove}
            onRevision={onRevision}
          />
        ) : (
          <SingleArtView
            variation={variations[0]}
            onApprove={() => onApprove()}
            onRevision={onRevision}
          />
        )}
      </div>
    </div>
  );
}

// Single art: big viewer + 2 CTAs at bottom
function SingleArtView({
  variation,
  onApprove,
  onRevision,
}: {
  variation: ArtworkVariation;
  onApprove: () => void;
  onRevision: () => void;
}) {
  return (
    <div className="space-y-5">
      <ArtViewer imageUrl={variation.url} title="Visualização da arte" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          className="h-14 gap-2 bg-emerald-600 text-base font-semibold hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] sm:h-16"
          onClick={onApprove}
        >
          <Check className="h-5 w-5" />
          Aprovar Arte
          <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="h-14 gap-2 border-2 border-[#f07d00]/40 text-base font-semibold text-[#f07d00] hover:border-[#f07d00] hover:bg-[#f07d00]/10 hover:shadow-lg hover:shadow-[#f07d00]/10 active:scale-[0.98] sm:h-16"
          onClick={onRevision}
        >
          <Pencil className="h-5 w-5" />
          Solicitar Ajuste
          <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
        </Button>
      </div>
    </div>
  );
}

// Multiple arts: stacked cards, each with its own approve CTA + shared revision link
function MultipleVariationsView({
  variations,
  onApprove,
  onRevision,
}: {
  variations: ArtworkVariation[];
  onApprove: (variationId: string) => void;
  onRevision: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">
        Compare as opções e escolha a que mais gostou:
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {variations.map((v) => (
          <div
            key={v.id}
            className="flex flex-col overflow-hidden rounded-xl border-2 border-border bg-card transition-colors hover:border-primary/30"
          >
            <div className="flex-1 p-3">
              <ArtViewer
                imageUrl={v.url}
                title={`Opção ${v.variationIndex}`}
                variationLabel={`Opção ${v.variationIndex}`}
              />
            </div>
            <div className="border-t border-border bg-muted/20 p-3">
              <Button
                size="lg"
                className="h-12 w-full gap-2 bg-emerald-600 font-semibold hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-500/20 active:scale-[0.98]"
                onClick={() => onApprove(v.id)}
              >
                <Check className="h-4 w-4" />
                Aprovar Opção {v.variationIndex}
                <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onRevision}
        className="h-12 w-full gap-2 border-2 border-[#f07d00]/50 font-semibold text-[#f07d00] hover:border-[#f07d00] hover:bg-[#f07d00]/10 hover:shadow-md active:scale-[0.98]"
      >
        <Pencil className="h-4 w-4" />
        Não gostou de nenhuma? Solicitar ajuste
      </Button>
    </div>
  );
}

// ─── Step 2a: Approve ─────────────────────────────────────────────────────────

function ApproveStep({
  orderTitle,
  variations,
  selectedVariationId,
  hasMultiple,
  isLoading,
  apiError,
  onBack,
  onSubmit,
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
  const selectedVariation = hasMultiple
    ? variations.find((v) => v.id === selectedVariationId)
    : variations[0];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApproveData>({ resolver: zodResolver(approveSchema) });

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const { ref: rhfRef, ...nameRest } = register("approverName");

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
      {/* Back + header + progress */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                Confirmar Aprovação
              </h1>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                Etapa 2 de 2
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Pedido: {orderTitle}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[90%] rounded-full bg-emerald-500 transition-all duration-500" />
        </div>
      </div>

      {/* Pending alert — principal gancho psicológico */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
            Aprovação pendente — ainda não concluída
          </p>
          <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/70">
            {hasMultiple && selectedVariation
              ? `Opção ${selectedVariation.variationIndex} escolhida. Confirme abaixo para registrar sua decisão.`
              : "Confirme seu nome abaixo para registrar a aprovação oficialmente."}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="approverName" className="text-sm font-semibold">
            Seu nome completo <span className="text-destructive">*</span>
          </Label>
          <Input
            id="approverName"
            placeholder="Ex: Maria da Silva"
            className="h-12 text-base ring-2 ring-emerald-500/30 focus:ring-emerald-500/60"
            disabled={isLoading}
            {...nameRest}
            ref={(el) => {
              rhfRef(el);
              nameRef.current = el;
            }}
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
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {apiError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="h-14 w-full animate-pulse gap-2 bg-emerald-600 text-base font-bold shadow-lg shadow-emerald-500/30 hover:animate-none hover:bg-emerald-700 hover:shadow-emerald-500/40 active:scale-[0.98] disabled:animate-none disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Registrando aprovação...
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              Confirmar aprovação agora
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Leva menos de 10 segundos · Você pode voltar e rever a arte a qualquer momento
        </p>
      </form>
    </div>
  );
}

// ─── Step 2b: Revision ────────────────────────────────────────────────────────

function RevisionStep({
  orderTitle,
  isLoading,
  apiError,
  onBack,
  onSubmit,
}: {
  orderTitle: string;
  isLoading: boolean;
  apiError: string | null;
  onBack: () => void;
  onSubmit: (data: RevisionData) => void;
}) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RevisionData>({ resolver: zodResolver(revisionSchema) });

  const feedback = watch("feedback") ?? "";

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const { ref: rhfRef, ...nameRest } = register("approverName");

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Solicitar Ajuste
          </h1>
          <p className="text-sm text-muted-foreground">Pedido: {orderTitle}</p>
        </div>
      </div>

      {/* Info badge */}
      <div className="flex items-center gap-3 rounded-xl border border-[#f07d00]/30 bg-[#f07d00]/8 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f07d00]/15">
          <Pencil className="h-5 w-5 text-[#f07d00]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#c4600a] dark:text-[#f4a55a]">
            Solicitar ajuste na arte
          </p>
          <p className="text-xs text-[#c4600a]/80 dark:text-[#f4a55a]/80">
            A equipe ADDS fará as alterações e enviará uma nova versão
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="approverName">
            Seu nome completo <span className="text-destructive">*</span>
          </Label>
          <Input
            id="approverName"
            placeholder="Ex: Maria da Silva"
            className="h-12 text-base"
            disabled={isLoading}
            {...nameRest}
            ref={(el) => {
              rhfRef(el);
              nameRef.current = el;
            }}
          />
          {errors.approverName && (
            <p className="text-xs text-destructive">{errors.approverName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="feedback">
            O que precisa ser ajustado? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="feedback"
            placeholder="Ex: Aumentar o logo, mudar a cor do fundo para azul..."
            rows={4}
            className="resize-none text-base"
            disabled={isLoading}
            {...register("feedback")}
          />
          <div className="flex items-center justify-between">
            {errors.feedback ? (
              <p className="text-xs text-destructive">{errors.feedback.message}</p>
            ) : (
              <span />
            )}
            <p
              className={cn(
                "text-xs tabular-nums",
                feedback.trim().length < 5
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {feedback.trim().length}/5 mín
            </p>
          </div>
        </div>

        {apiError && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {apiError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="h-14 w-full gap-2 bg-[#f07d00] text-base font-semibold hover:bg-[#d96e00] hover:shadow-lg hover:shadow-[#f07d00]/20 active:scale-[0.98] disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Pencil className="h-5 w-5" />
              Enviar solicitação de ajuste
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
