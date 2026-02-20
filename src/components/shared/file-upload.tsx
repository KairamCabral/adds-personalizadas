"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileIcon } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onUpload: (files: File[]) => void;
  className?: string;
  disabled?: boolean;
  isUploading?: boolean;
}

export function FileUpload({
  accept,
  maxSize = 10 * 1024 * 1024,
  multiple = false,
  onUpload,
  className,
  disabled = false,
  isUploading = false,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      setError(null);

      const validFiles: File[] = [];
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        if (file.size > maxSize) {
          setError(`Arquivo "${file.name}" excede o tamanho máximo de ${formatFileSize(maxSize)}`);
          return;
        }
        validFiles.push(file);
      }

      const updated = multiple ? [...files, ...validFiles] : validFiles;
      setFiles(updated);
      onUpload(updated);
    },
    [files, maxSize, multiple, onUpload]
  );

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onUpload(updated);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          {isUploading ? (
            "Enviando..."
          ) : (
            <>
              Arraste arquivos aqui ou{" "}
              <span className="text-primary underline">selecione</span>
            </>
          )}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Máximo {formatFileSize(maxSize)} por arquivo
        </p>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-md border bg-card p-2"
            >
              <FileIcon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {isUploading ? "Enviando..." : formatFileSize(file.size)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeFile(i)}
                disabled={isUploading}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
