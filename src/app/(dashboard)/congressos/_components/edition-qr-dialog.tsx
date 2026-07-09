"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EventEdition } from "@/types/database.types";

interface EditionQrDialogProps {
  edition: EventEdition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditionQrDialog({
  edition,
  open,
  onOpenChange,
}: EditionQrDialogProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const url = edition ? `${baseUrl}/evento/${edition.slug}` : "";

  useEffect(() => {
    if (!open || !url) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(url, { width: 320, margin: 2 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [open, url]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const downloadQr = () => {
    if (!dataUrl || !edition) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${edition.slug}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link e QR do estande</DialogTitle>
        </DialogHeader>

        {edition && (
          <div className="space-y-4">
            {!edition.is_active && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                Esta edição está inativa — o pré-cadastro público está fechado.
              </p>
            )}

            <div className="flex justify-center">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataUrl}
                  alt={`QR code de ${edition.name}`}
                  className="h-64 w-64 rounded-md border bg-white p-2"
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-sm text-muted-foreground">
                  Gerando QR...
                </div>
              )}
            </div>

            <div className="break-all rounded-md border bg-muted/40 p-2 text-center text-sm">
              {url}
            </div>

            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadQr}
                disabled={!dataUrl}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar QR
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
