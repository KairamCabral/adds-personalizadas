"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArtViewer } from "./art-viewer";
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

const approvalSchema = z.object({
  approverName: z.string().min(1, "Informe seu nome"),
  decision: z.enum(["approve", "revision"], {
    required_error: "Selecione uma opção",
  }),
  feedback: z.string().optional(),
}).refine(
  (data) => {
    if (data.decision === "revision") {
      return !!data.feedback?.trim() && data.feedback.trim().length >= 5;
    }
    return true;
  },
  {
    message: "Descreva o ajuste necessário (mínimo 5 caracteres)",
    path: ["feedback"],
  }
);

type ApprovalFormData = z.infer<typeof approvalSchema>;

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

export function ApprovalForm({
  token,
  orderTitle,
  variations,
}: ApprovalFormProps) {
  const hasMultiple = variations.length > 1;
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(
    hasMultiple ? null : variations[0]?.id ?? null
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [successType, setSuccessType] = useState<"approve" | "revision">("approve");
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      approverName: "",
      decision: hasMultiple ? "revision" : undefined,
      feedback: "",
    },
  });

  useEffect(() => {
    if (hasMultiple) form.setValue("decision", "revision");
  }, [hasMultiple, form]);

  const decision = form.watch("decision");
  const feedback = form.watch("feedback");

  async function submitDecision(data: ApprovalFormData, approvedArtworkId?: string) {
    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        token,
        approved: data.decision === "approve",
        approver_name: data.approverName.trim(),
        feedback: data.decision === "revision" ? data.feedback?.trim() : undefined,
      };
      if (data.decision === "approve" && (hasMultiple ? approvedArtworkId : variations[0]?.id)) {
        payload.approved_artwork_id = hasMultiple ? approvedArtworkId : variations[0]?.id;
      }
      const res = await fetch("/api/art/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Erro ao processar");
      }

      setSuccessType(data.decision);
      setIsSuccess(true);
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : "Erro ao processar. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
      setShowApproveConfirm(false);
    }
  }

  function handleApproveClick(artworkId?: string) {
    const data = form.getValues();
    if (data.decision === "approve" || (hasMultiple && artworkId)) {
      if (!data.approverName?.trim()) {
        form.setError("approverName", { message: "Informe seu nome" });
        return;
      }
      if (hasMultiple && artworkId) setSelectedApprovalId(artworkId);
      setShowApproveConfirm(true);
    } else {
      form.handleSubmit((d) => submitDecision(d))();
    }
  }

  if (isSuccess) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-300 rounded-2xl border border-border bg-card p-6 text-center shadow-xl ring-1 ring-border/50 sm:p-8">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
          {successType === "approve"
            ? "Arte aprovada com sucesso!"
            : "Sua solicitação foi enviada!"}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          {successType === "approve"
            ? "A equipe ADDS já foi notificada."
            : "A equipe ADDS fará os ajustes e enviará uma nova versão."}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-4 lg:flex lg:min-h-0 lg:flex-row lg:items-stretch lg:gap-6 lg:space-y-0">
      <div className="lg:flex lg:min-w-0 lg:flex-1 lg:flex-col">
        <div className="mb-3 text-center lg:mb-4 lg:text-left">
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Aprovação de Arte
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedido: {orderTitle}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4 lg:min-h-0 lg:flex-1">
          {hasMultiple ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">
                Escolha a opção que mais gostou
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {variations.map((v) => (
                  <div
                    key={v.id}
                    className="overflow-hidden rounded-lg border-2 border-border transition-colors has-[button:focus]:border-primary hover:border-primary/50"
                  >
                    <ArtViewer
                      imageUrl={v.url}
                      title={`Opção ${v.variationIndex}`}
                    />
                    <div className="border-t border-border bg-muted/30 p-2">
                      <Button
                        type="button"
                        size="sm"
                        className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                        disabled={isLoading}
                        onClick={() => handleApproveClick(v.id)}
                      >
                        <Check className="h-4 w-4" />
                        Aprovar esta opção
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ArtViewer
              imageUrl={variations[0]?.url ?? ""}
              title="Visualização da arte"
            />
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:min-w-[320px] lg:max-w-md">
          <form
          onSubmit={form.handleSubmit((d) => {
            if (d.decision === "approve" && !hasMultiple) {
              setShowApproveConfirm(true);
            } else {
              submitDecision(
                { ...d, decision: "revision" as const },
                undefined
              );
            }
          })}
          className="flex flex-1 flex-col gap-4"
        >
          {hasMultiple && (
            <input
              type="hidden"
              {...form.register("decision")}
              defaultValue="revision"
            />
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="approverName">Seu nome</Label>
              <Input
                id="approverName"
                placeholder="Coloque seu nome completo"
                disabled={isLoading}
                className="text-base"
                {...form.register("approverName")}
              />
              {form.formState.errors.approverName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.approverName.message}
                </p>
              )}
            </div>

            {!hasMultiple && (
              <div className="space-y-1.5">
                <Label>Decisão</Label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-border p-3 transition-all duration-200 hover:border-emerald-500/50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10 has-[:checked]:shadow-md sm:gap-3 sm:p-4">
                    <input
                      type="radio"
                      value="approve"
                      disabled={isLoading}
                      {...form.register("decision")}
                      className="sr-only"
                    />
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 sm:h-5 sm:w-5" />
                    <span className="text-sm font-medium sm:text-base">Aprovar Arte</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-border p-3 transition-all duration-200 hover:border-[#f07d00]/50 has-[:checked]:border-[#f07d00] has-[:checked]:bg-[#f07d00]/10 has-[:checked]:shadow-md sm:gap-3 sm:p-4">
                    <input
                      type="radio"
                      value="revision"
                      disabled={isLoading}
                      {...form.register("decision")}
                      className="sr-only"
                    />
                    <Pencil className="h-4 w-4 shrink-0 text-[#f07d00] sm:h-5 sm:w-5" />
                    <span className="text-sm font-medium sm:text-base">Solicitar Ajuste</span>
                  </label>
                </div>
                {form.formState.errors.decision && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.decision.message}
                  </p>
                )}
              </div>
            )}
            {hasMultiple && (
              <p className="text-xs text-muted-foreground">
                Não gostou de nenhuma opção? Solicite ajuste abaixo.
              </p>
            )}

            {(decision === "revision" || hasMultiple) && (
              <div className="space-y-1.5">
                <Label htmlFor="feedback">Descreva o que precisa ser ajustado</Label>
                <Textarea
                  id="feedback"
                  placeholder="Ex: Aumentar o tamanho da logo e mudar a cor do texto..."
                  rows={3}
                  disabled={isLoading}
                  {...form.register("feedback")}
                />
                {(decision === "revision" || hasMultiple) &&
                  feedback !== undefined && (
                    <p
                      className={
                        feedback?.trim().length >= 5
                          ? "text-xs text-muted-foreground"
                          : "text-xs text-amber-600 dark:text-amber-500"
                      }
                    >
                      {feedback?.trim().length >= 5
                        ? `${feedback.trim().length} caracteres`
                        : `Digite pelo menos 5 caracteres (${feedback?.trim().length ?? 0}/5)`}
                    </p>
                  )}
                {form.formState.errors.feedback && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.feedback.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
            {decision === "revision" || hasMultiple ? (
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  ((decision === "revision" || hasMultiple) &&
                    (!feedback?.trim() || feedback.trim().length < 5))
                }
                className="w-full bg-[#f07d00] transition-all hover:bg-[#f07d00]/90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed sm:flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar solicitação de ajuste"
                )}
              </Button>
            ) : (
              !hasMultiple && (
                <Button
                  type="button"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 transition-all hover:bg-emerald-700 hover:shadow-lg sm:flex-1"
                  onClick={() => setShowApproveConfirm(true)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Aprovar Arte
                    </>
                  )}
                </Button>
              )
            )}
          </div>
        </form>
      </div>

      <AlertDialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasMultiple
                ? "A opção escolhida será enviada para produção. As outras opções não serão utilizadas. Esta ação não pode ser desfeita."
                : "Após aprovar, a arte será enviada para produção. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                const data = form.getValues();
                await submitDecision(
                  { ...data, decision: "approve" },
                  hasMultiple ? selectedApprovalId ?? undefined : undefined
                );
              }}
              disabled={isLoading || (hasMultiple && !selectedApprovalId)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? "Processando..." : "Sim, aprovar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
