"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getArtworksByOrder,
  uploadArtwork,
  generateApprovalLink,
  generateBundleApprovalLink,
  getActiveToken,
  deleteArtwork,
  groupArtworksByVersion,
} from "@/services/artworks.service";
import { formatDateTime, formatFileSize } from "@/lib/utils";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import {
  Image,
  FileText,
  Copy,
  Check,
  Link2,
  Plus,
  Download,
  Trash2,
  AlertTriangle,
  MessageSquare,
  Send,
  Layers,
  Pencil,
  Users,
  Loader2,
  ChevronRight,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Artwork } from "@/services/artworks.service";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: "Aguardando aprovação", color: "bg-amber-500/20 text-amber-600 dark:text-amber-400" },
  APROVADA: { label: "Aprovada", color: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" },
  AJUSTE_SOLICITADO: { label: "Ajuste solicitado", color: "bg-red-500/20 text-red-600 dark:text-red-400" },
  DESCARTADA: { label: "Não escolhida", color: "bg-muted text-muted-foreground" },
};

/** Outline + fundo laranja claro no hover: o Button outline aplica hover:text-accent-foreground (branco), incompatível com fundo claro. */
const ORANGE_OUTLINE_BTN =
  "border-orange-600/55 bg-background font-medium text-orange-950 shadow-sm hover:border-orange-600 hover:bg-orange-500/15 hover:!text-orange-950 dark:border-orange-500/50 dark:text-orange-200 dark:hover:bg-orange-500/25 dark:hover:!text-orange-50";

interface OrderArtworkProps {
  orderId: string;
}

export function OrderArtwork({ orderId }: OrderArtworkProps) {
  const queryClient = useQueryClient();
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [showAddVariation, setShowAddVariation] = useState(false);
  const [zoomArtwork, setZoomArtwork] = useState<Artwork | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Artwork | null>(null);

  const { data: artworks = [], isLoading } = useQuery({
    queryKey: ["artworks", orderId],
    queryFn: () => getArtworksByOrder(orderId),
  });

  const byVersion = groupArtworksByVersion(artworks);
  const versions = Array.from(byVersion.keys()).sort((a, b) => b - a);
  const latestVersion = versions[0];
  const latestVariations = latestVersion != null ? (byVersion.get(latestVersion) ?? []) : [];
  const historyVersions = versions.slice(1);
  const hasAdjustmentOnLatest = latestVariations.some((v) => v.status === "AJUSTE_SOLICITADO");

  const uploadMutation = useMutation({
    mutationFn: ({ file, asVariation }: { file: File; asVariation?: boolean }) => {
      const adjustmentNote = latestVariations.find((v) => v.status === "AJUSTE_SOLICITADO")?.adjustment_notes;
      return uploadArtwork(orderId, file, {
        asVariation,
        notes: asVariation ? undefined : adjustmentNote ? `Revisão do ajuste: ${adjustmentNote}` : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artworks", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setShowNewVersion(false);
      setShowAddVariation(false);
      toast.success("Arte enviada com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArtwork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artworks", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setDeleteTarget(null);
      toast.success("Arte excluída.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (artworks.length === 0 && !showNewVersion) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Image className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Nenhuma arte enviada
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Faça upload da arte para este pedido
          </p>
          <div className="mt-6 w-full max-w-sm">
            <FileUpload
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              maxSize={20 * 1024 * 1024}
              onUpload={(files) => files[0] && uploadMutation.mutate({ file: files[0] })}
              disabled={uploadMutation.isPending}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              JPG, PNG ou PDF · Máx 20MB
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {latestVariations.length > 0 && (
        <LatestArtworkCard
          variations={latestVariations}
          orderId={orderId}
          onUploadNew={() => setShowNewVersion(true)}
          onAddVariation={() => setShowAddVariation(true)}
          onZoom={(aw) => setZoomArtwork(aw)}
          onDelete={(aw) => setDeleteTarget(aw)}
          isUploading={uploadMutation.isPending}
        />
      )}

      {showNewVersion && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            {hasAdjustmentOnLatest ? "Enviar nova revisão" : "Enviar nova versão"}
          </p>
          <FileUpload
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            maxSize={20 * 1024 * 1024}
            onUpload={(files) => files[0] && uploadMutation.mutate({ file: files[0] })}
            disabled={uploadMutation.isPending}
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowNewVersion(false)}
          >
            Cancelar
          </Button>
        </div>
      )}

      {showAddVariation && (
        <div className="rounded-lg border border-adds-orange/30 bg-adds-orange/5 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            Adicionar variação à v{latestVersion}
          </p>
          <FileUpload
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            maxSize={20 * 1024 * 1024}
            onUpload={(files) => files[0] && uploadMutation.mutate({ file: files[0], asVariation: true })}
            disabled={uploadMutation.isPending}
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowAddVariation(false)}
          >
            Cancelar
          </Button>
        </div>
      )}

      {historyVersions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            Histórico de versões
          </h4>
          <div className="space-y-2">
            {historyVersions.map((ver) => (
              <HistoryVersionItem
                key={ver}
                version={ver}
                variations={byVersion.get(ver) ?? []}
              />
            ))}
          </div>
        </div>
      )}

      <ArtworkZoomDialog
        artwork={zoomArtwork}
        onClose={() => setZoomArtwork(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir arte"
        description="Tem certeza? Só é possível excluir artes aguardando aprovação e sem link ativo."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

function LatestArtworkCard({
  variations,
  orderId,
  onUploadNew,
  onAddVariation,
  onZoom,
  onDelete,
  isUploading,
}: {
  variations: Artwork[];
  orderId: string;
  onUploadNew: () => void;
  onAddVariation: () => void;
  onZoom: (artwork: Artwork) => void;
  onDelete: (artwork: Artwork) => void;
  isUploading: boolean;
}) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(() => {
    // Auto-select the variation that needs adjustment so the designer sees it first
    const adjIdx = variations.findIndex((v) => v.status === "AJUSTE_SOLICITADO");
    return adjIdx >= 0 ? adjIdx : 0;
  });
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [showBundleDialog, setShowBundleDialog] = useState(false);
  const [bundleLabels, setBundleLabels] = useState<Record<string, string>>({});
  const [bundleLinkLoading, setBundleLinkLoading] = useState(false);

  const primary = variations[0];
  const representativeId = primary?.id ?? "";
  const hasMultiple = variations.length > 1;
  const allPending = variations.every((v) => v.status === "PENDENTE");
  const hasAdjustmentRequested = variations.some((v) => v.status === "AJUSTE_SOLICITADO");
  const adjustmentVariations = variations.filter((v) => v.status === "AJUSTE_SOLICITADO");
  const approvedVariations = variations.filter((v) => v.status === "APROVADA");
  // Deprecated single-detail kept for compatibility in non-bundle context
  const adjustmentDetail = adjustmentVariations[0] ?? null;

  const { data: activeToken } = useQuery({
    queryKey: ["approval-token", representativeId],
    queryFn: () => getActiveToken(representativeId),
    enabled: !hasAdjustmentRequested && !!representativeId,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateApprovalLink(representativeId),
    onSuccess: (url) => {
      queryClient.invalidateQueries({ queryKey: ["approval-token", representativeId] });
      setGeneratedLink(url);
      setShowLinkDialog(true);
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setLinkLoading(false),
  });

  const aggregatedStatus = (() => {
    if (variations.some((v) => v.status === "APROVADA")) return "APROVADA";
    if (variations.some((v) => v.status === "AJUSTE_SOLICITADO")) return "AJUSTE_SOLICITADO";
    return primary?.status ?? "PENDENTE";
  })();
  const config = STATUS_CONFIG[aggregatedStatus] ?? { label: "", color: "" };
  const current = variations[selectedIdx] ?? primary;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              Arte v{primary?.version}
              {hasMultiple && ` (${variations.length} opções)`}
            </span>
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", config.color)}>
              {config.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enviada em {formatDateTime(primary?.created_at ?? "")}
          </p>
        </div>
        {current?.status === "PENDENTE" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => current && onDelete(current)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {hasAdjustmentRequested && (
        <div className="mt-3 space-y-2">
          {/* One card per variation that needs adjustment — crystal clear */}
          {adjustmentVariations.map((v) => {
            const optionNumber = variations.findIndex((x) => x.id === v.id) + 1;
            return (
              <div
                key={v.id}
                className="rounded-xl border-2 border-amber-500/40 bg-amber-500/8 p-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                      {hasMultiple
                        ? `Ajuste solicitado na Opção ${optionNumber}`
                        : "Cliente solicitou ajuste"}
                    </p>
                    {v.adjustment_notes && (
                      <p className="mt-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-sm italic text-foreground">
                        &ldquo;{v.adjustment_notes}&rdquo;
                      </p>
                    )}
                    {v.approved_by && (
                      <p className="mt-1 text-xs text-muted-foreground">— {v.approved_by}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Approved variations (in a mixed bundle scenario) */}
          {approvedVariations.length > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-3 py-2.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {approvedVariations
                  .map((v) => {
                    const n = variations.findIndex((x) => x.id === v.id) + 1;
                    return hasMultiple ? `Opção ${n}` : "Arte";
                  })
                  .join(", ")}{" "}
                aprovada{approvedVariations.length > 1 ? "s" : ""}
                {approvedVariations[0]?.approved_by && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    por {approvedVariations[0].approved_by}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        {hasMultiple ? (
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {variations.map((aw, i) => {
                const isAdj = aw.status === "AJUSTE_SOLICITADO";
                const isApproved = aw.status === "APROVADA";
                const isDiscarded = aw.status === "DESCARTADA";
                return (
                  <button
                    key={aw.id}
                    type="button"
                    onClick={() => setSelectedIdx(i)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors",
                      selectedIdx === i
                        ? isAdj
                          ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : isApproved
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : isDiscarded
                          ? "border-muted-foreground/40 bg-muted/60 text-muted-foreground opacity-75"
                          : "border-primary bg-primary/10 text-primary"
                        : isAdj
                        ? "border-amber-500/40 bg-amber-500/5 text-amber-600/80 hover:border-amber-500/70 dark:text-amber-400/80"
                        : isApproved
                        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600/80 hover:border-emerald-500/70 dark:text-emerald-400/80"
                        : isDiscarded
                        ? "border-dashed border-border bg-muted/20 text-muted-foreground/60 opacity-60 hover:opacity-80"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {isAdj && <AlertTriangle className="h-3 w-3" />}
                    {isApproved && <Check className="h-3 w-3" />}
                    {isDiscarded && <Ban className="h-3 w-3" />}
                    Opção {i + 1}
                    {isAdj && <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">AJUSTAR</span>}
                    {isApproved && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">OK</span>}
                    {isDiscarded && <span className="rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">NÃO ESCOLHIDA</span>}
                  </button>
                );
              })}
            </div>
            <VariationPreview
              artwork={current}
              onZoom={() => current && onZoom(current)}
              isDiscarded={current?.status === "DESCARTADA"}
            />
          </div>
        ) : (
          <VariationPreview
            artwork={primary}
            onZoom={() => primary && onZoom(primary)}
            isDiscarded={primary?.status === "DESCARTADA"}
          />
        )}
      </div>

      {!hasAdjustmentRequested && (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Link2 className="h-4 w-4" />
            Link de aprovação
          </p>
          {activeToken ? (
            <div className="space-y-2">
              <p className="break-all font-mono text-xs text-muted-foreground">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/art/approve/${activeToken.token}`
                  : `/art/approve/${activeToken.token}`}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/art/approve/${activeToken.token}`;
                  setGeneratedLink(url);
                  setShowLinkDialog(true);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado!" : "Copiar link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Expira em {formatDateTime(activeToken.expires_at)}
              </p>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={linkLoading || isUploading}
              onClick={() => {
                setLinkLoading(true);
                generateMutation.mutate();
              }}
            >
              {linkLoading ? "Gerando..." : (
                <>
                  <Plus className="h-4 w-4" />
                  Gerar link de aprovação
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Bundle link — only when there are 2+ pending variations */}
      {!hasAdjustmentRequested && allPending && hasMultiple && (
        <div className="mt-4 overflow-hidden rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/5 via-primary/5 to-primary/10">
          {/* Header */}
          <div className="flex items-start gap-3 p-4 pb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground leading-tight">
                Aprovação individual por arte
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                O cliente decide em cada arte separadamente — pode aprovar uma e pedir ajuste na outra.
              </p>
            </div>
          </div>

          {/* Use cases chips */}
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
              🦷 Clínica com 2+ dentistas
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
              📦 Produtos diferentes
            </span>
          </div>

          {/* Divider + CTA */}
          <div className="border-t border-primary/15 bg-primary/5 px-4 py-3">
            <Button
              size="sm"
              className="w-full gap-2 bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98]"
              onClick={() => {
                const initial: Record<string, string> = {};
                variations.forEach((v, i) => {
                  initial[v.id] = `Arte ${i + 1}`;
                });
                setBundleLabels(initial);
                setShowBundleDialog(true);
              }}
            >
              <Users className="h-4 w-4" />
              Gerar link com decisão por arte
              <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
            </Button>
          </div>
        </div>
      )}

      {(allPending || hasAdjustmentRequested) && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={hasAdjustmentRequested ? "default" : "outline"}
            size="sm"
            className={cn(
              "gap-2",
              hasAdjustmentRequested && "bg-primary hover:bg-primary/90"
            )}
            onClick={onUploadNew}
            disabled={isUploading}
          >
            <Plus className="h-4 w-4" />
            {hasAdjustmentRequested ? "Enviar nova revisão" : "Enviar nova versão"}
          </Button>
          {allPending && (
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2", ORANGE_OUTLINE_BTN)}
              onClick={onAddVariation}
              disabled={isUploading}
            >
              <Plus className="h-4 w-4" />
              Adicionar variação
            </Button>
          )}
        </div>
      )}

      {/* Bundle link generation dialog */}
      <Dialog open={showBundleDialog} onOpenChange={setShowBundleDialog}>
        <DialogContent className="z-[200] gap-0 overflow-hidden p-0 sm:max-w-lg">
          {/* Dialog header */}
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold leading-tight">
                    Nomeie cada arte
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-muted-foreground mt-0.5">
                  O cliente verá esse nome ao revisar — use o nome do dentista ou produto.
                </p>
              </div>
            </div>
          </div>

          {/* Arts list with thumbnails */}
          <div className="space-y-3 px-6 py-5">
            {variations.map((v, i) => {
              const isPdf = v.file_url?.toLowerCase().includes(".pdf");
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors focus-within:border-primary/40 focus-within:bg-primary/5"
                >
                  {/* Thumbnail */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center">
                    {isPdf ? (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <img
                        src={v.file_url}
                        alt={`Arte ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  {/* Input */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Arte {i + 1}
                    </label>
                    <input
                      autoFocus={i === 0}
                      className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium placeholder-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={bundleLabels[v.id] ?? `Arte ${i + 1}`}
                      placeholder="Ex: Dr. João Silva"
                      onChange={(e) =>
                        setBundleLabels((prev) => ({ ...prev, [v.id]: e.target.value }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint + actions */}
          <div className="border-t border-border bg-muted/30 px-6 py-4">
            <p className="mb-3 flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-px shrink-0 text-sm">💡</span>
              <span>O link gerado abre uma página onde o cliente revisa cada arte e decide individualmente.</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowBundleDialog(false)}
                disabled={bundleLinkLoading}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-2 bg-primary font-semibold hover:bg-primary/90"
                disabled={bundleLinkLoading}
                onClick={async () => {
                  setBundleLinkLoading(true);
                  try {
                    const items = variations.map((v) => ({
                      artworkId: v.id,
                      label: bundleLabels[v.id]?.trim() || `Arte ${v.variation_index ?? 1}`,
                      orderId: orderId,
                    }));
                    const link = await generateBundleApprovalLink(items);
                    setGeneratedLink(link);
                    setShowBundleDialog(false);
                    setShowLinkDialog(true);
                    queryClient.invalidateQueries({ queryKey: ["approval-token", representativeId] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro ao gerar link");
                  } finally {
                    setBundleLinkLoading(false);
                  }
                }}
              >
                {bundleLinkLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                ) : (
                  <><Link2 className="h-4 w-4" /> Gerar link</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="z-[200] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviará para o cliente agora?</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-3">
            <p className="break-all font-mono text-xs text-muted-foreground">
              {generatedLink}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                if (generatedLink) {
                  navigator.clipboard.writeText(generatedLink);
                  toast.success("Link copiado!");
                }
                setShowLinkDialog(false);
              }}
            >
              <Copy className="h-4 w-4" />
              Só copiar
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={async () => {
                if (generatedLink) {
                  navigator.clipboard.writeText(generatedLink);
                }
                try {
                  const { createClient } = await import('@/lib/supabase/client');
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  const { data: existingLabel } = await supabase
                    .from('order_labels')
                    .select('id')
                    .eq('order_id', orderId)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .eq('label', 'LINK_ENVIADO' as any)
                    .maybeSingle();
                  if (!existingLabel) {
                    await supabase.from('order_labels').insert({
                      order_id: orderId,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      label: 'LINK_ENVIADO' as any,
                      added_by: user?.id ?? null,
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: ["orders"] });
                  queryClient.invalidateQueries({ queryKey: ["order", orderId] });
                  toast.success("Link copiado e marcado como enviado!");
                } catch {
                  toast.success("Link copiado!");
                }
                setShowLinkDialog(false);
              }}
            >
              <Send className="h-4 w-4" />
              Enviar ao cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VariationPreview({
  artwork,
  onZoom,
  isDiscarded = false,
}: {
  artwork: Artwork;
  onZoom: () => void;
  isDiscarded?: boolean;
}) {
  if (!artwork) return null;
  const isPdf =
    (artwork.file_url ?? "").toLowerCase().endsWith(".pdf") ||
    (artwork.file_name ?? "").toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return (
      <div
        className={cn(
          "relative flex cursor-pointer items-center gap-3 rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50",
          isDiscarded ? "border-dashed opacity-60 grayscale" : "border-border"
        )}
        onClick={() => window.open(artwork.file_url, "_blank")}
      >
        {isDiscarded && (
          <div className="absolute left-2 top-2 rounded-md border border-muted-foreground/30 bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Não escolhida
          </div>
        )}
        <FileText className="h-12 w-12 shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">{artwork.file_name ?? "Arquivo PDF"}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(artwork.file_size ?? 0)}
          </p>
        </div>
        <Download className="ml-auto h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-lg border bg-muted/30",
          isDiscarded ? "border-dashed border-muted-foreground/30 opacity-70" : "border-border"
        )}
        onClick={onZoom}
      >
        <img
          src={artwork.file_url}
          alt={`Arte v${artwork.version}`}
          className={cn(
            "aspect-video w-full object-contain",
            isDiscarded && "grayscale"
          )}
        />
        {isDiscarded && (
          <div className="absolute left-2 top-2 rounded-md border border-muted-foreground/30 bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Não escolhida
          </div>
        )}
        <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
          Clique para ampliar
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {artwork.file_name ?? "Arquivo"} · {formatFileSize(artwork.file_size ?? 0)}
        <Button
          variant="link"
          className="ml-2 h-auto p-0 text-xs"
          onClick={() => window.open(artwork.file_url, "_blank")}
        >
          Download
        </Button>
      </p>
    </>
  );
}

function HistoryVersionItem({
  version,
  variations,
}: {
  version: number;
  variations: Artwork[];
}) {
  const primary = variations[0];
  const config = STATUS_CONFIG[primary?.status ?? "PENDENTE"] ?? { label: "", color: "" };
  const hasMultiple = variations.length > 1;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">
          v{version}
          {hasMultiple && ` (${variations.length} opções)`}
        </span>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", config.color)}>
          {config.label}
        </span>
      </div>
      {primary?.adjustment_notes && (
        <div className="mt-1.5 flex items-start gap-1.5">
          <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <p className="text-xs italic text-muted-foreground">
            &ldquo;{primary.adjustment_notes}&rdquo;
          </p>
        </div>
      )}
      {primary?.approved_by && (
        <p className="mt-1 text-xs text-muted-foreground">— {primary.approved_by}</p>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground/80">
        Enviada em {formatDateTime(primary?.created_at ?? "")}
      </p>
    </div>
  );
}

function ArtworkZoomDialog({
  artwork,
  onClose,
}: {
  artwork: Artwork | null;
  onClose: () => void;
}) {
  if (!artwork) return null;
  const isPdf = (artwork.file_url ?? "").toLowerCase().endsWith(".pdf");
  return (
    <Dialog open={!!artwork} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Arte v{artwork.version}</DialogTitle>
        </DialogHeader>
        {isPdf ? (
          <a
            href={artwork.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary underline"
          >
            <FileText className="h-5 w-5" />
            Abrir PDF em nova aba
          </a>
        ) : (
          <img
            src={artwork.file_url}
            alt={`Arte v${artwork.version}`}
            className="w-full object-contain"
            style={{ maxHeight: "70vh" }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
