"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface DiyLogoUploadProps {
  logoFile: File | null;
  logoPreviewUrl: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
}

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPTED = ".jpg,.jpeg,.png,.svg,.pdf,.cdr";

export function DiyLogoUpload({
  logoFile,
  logoPreviewUrl,
  onChange,
}: DiyLogoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_SIZE) {
        alert("Arquivo muito grande. Máximo 10MB.");
        return;
      }
      const isImage = file.type.startsWith("image/");
      if (isImage) {
        const url = URL.createObjectURL(file);
        onChange(file, url);
      } else {
        onChange(file, null);
      }
    },
    [onChange],
  );

  const removeLogo = useCallback(() => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    onChange(null, null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [logoPreviewUrl, onChange]);

  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold">Logo</Label>

      {logoFile ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          {logoPreviewUrl ? (
            <img
              src={logoPreviewUrl}
              alt="Logo"
              className="h-12 w-12 rounded object-contain bg-white p-1"
            />
          ) : (
            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{logoFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(logoFile.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            onClick={removeLogo}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
        >
          <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">
            Arraste ou clique · JPG, PNG, SVG · Máx 10MB
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
      />
    </div>
  );
}
