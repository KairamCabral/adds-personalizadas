"use client";

import { useCallback, useRef } from "react";
import { Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
];
const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".pdf", ".cdr"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface LogoUploadProps {
  file: File | null;
  previewUrl: string | null;
  onFileChange: (file: File | null) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LogoUpload({
  file,
  previewUrl,
  onFileChange,
}: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback((f: File): boolean => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXT.includes(ext) && !ACCEPTED_TYPES.includes(f.type)) {
      toast.error(
        "Formato não suportado. Use JPG, PNG, PDF ou CDR."
      );
      return false;
    }
    if (f.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return false;
    }
    return true;
  }, []);

  const handleFile = useCallback(
    (f: File | null) => {
      if (!f) {
        onFileChange(null);
        return;
      }
      if (validate(f)) {
        onFileChange(f);
      }
    },
    [onFileChange, validate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const isImage = file && file.type.startsWith("image/");

  return (
    <div className="space-y-2">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 py-8 transition-colors hover:border-primary/30 hover:bg-muted/50"
        >
          <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Arraste a logo ou clique para selecionar
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, PNG, PDF ou CDR · Máximo 10MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXT.join(",")}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          {isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleFile(null)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remover arquivo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
