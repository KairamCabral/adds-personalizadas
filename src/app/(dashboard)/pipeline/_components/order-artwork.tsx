"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getArtworksByOrder,
  uploadArtwork,
  generateApprovalLink,
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
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const primary = variations[0];
  const representativeId = primary?.id ?? "";
  const hasMultiple = variations.length > 1;
  const allPending = variations.every((v) => v.status === "PENDENTE");
  const hasAdjustmentRequested = variations.some((v) => v.status === "AJUSTE_SOLICITADO");
  const adjustmentDetail = variations.find((v) => v.status === "AJUSTE_SOLICITADO");

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

  const config = STATUS_CONFIG[primary?.status ?? "PENDENTE"] ?? { label: "", color: "" };
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

      {hasAdjustmentRequested && adjustmentDetail && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Cliente solicitou ajuste
              </p>
              {adjustmentDetail.adjustment_notes && (
                <p className="mt-1 text-sm italic text-foreground">
                  &ldquo;{adjustmentDetail.adjustment_notes}&rdquo;
                </p>
              )}
              {adjustmentDetail.approved_by && (
                <p className="mt-1 text-xs text-muted-foreground">
                  — {adjustmentDetail.approved_by}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        {hasMultiple ? (
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {variations.map((aw, i) => (
                <button
                  key={aw.id}
                  type="button"
                  onClick={() => setSelectedIdx(i)}
                  className={cn(
                    "shrink-0 rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedIdx === i
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  )}
                >
                  Opção {i + 1}
                </button>
              ))}
            </div>
            <VariationPreview artwork={current} onZoom={() => current && onZoom(current)} />
          </div>
        ) : (
          <VariationPreview artwork={primary} onZoom={() => primary && onZoom(primary)} />
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
              className="gap-2 border-adds-orange/50 text-adds-orange hover:bg-adds-orange/10"
              onClick={onAddVariation}
              disabled={isUploading}
            >
              <Plus className="h-4 w-4" />
              Adicionar variação
            </Button>
          )}
        </div>
      )}

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
}: {
  artwork: Artwork;
  onZoom: () => void;
}) {
  if (!artwork) return null;
  const isPdf =
    (artwork.file_url ?? "").toLowerCase().endsWith(".pdf") ||
    (artwork.file_name ?? "").toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return (
      <div
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
        onClick={() => window.open(artwork.file_url, "_blank")}
      >
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
        className="relative cursor-pointer overflow-hidden rounded-lg border border-border bg-muted/30"
        onClick={onZoom}
      >
        <img
          src={artwork.file_url}
          alt={`Arte v${artwork.version}`}
          className="aspect-video w-full object-contain"
        />
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
