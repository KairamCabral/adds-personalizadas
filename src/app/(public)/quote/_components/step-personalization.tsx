"use client";

import {
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  FileIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import type { WizardPersonalization } from "./quote-wizard-types";

const ACCEPTED_TYPES = ".jpg,.jpeg,.png,.pdf,.cdr";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface StepPersonalizationProps {
  data: WizardPersonalization;
  onChange: (data: WizardPersonalization) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPersonalization({
  data,
  onChange,
  onNext,
  onBack,
}: StepPersonalizationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const update = (field: keyof WizardPersonalization, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleFile = (file: File) => {
    if (file.size > MAX_SIZE) {
      alert("Arquivo muito grande. Máximo 10MB.");
      return;
    }
    onChange({ ...data, logo_file: file });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const removeLogo = () => {
    onChange({ ...data, logo_file: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isImage = data.logo_file?.type.startsWith("image/");
  const logoPreviewUrl =
    data.logo_file && isImage
      ? URL.createObjectURL(data.logo_file)
      : null;

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Personalização</h2>
        <p className="text-muted-foreground">
          Detalhes de cores, arte e sua logo
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="print_color">Cor de impressão</Label>
          <Input
            id="print_color"
            placeholder="Ex: Branco, Prata, Dourado..."
            value={data.print_color}
            onChange={(e) => update("print_color", e.target.value)}
            className="h-11 focus-visible:ring-2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom_color">Cor personalizada (se aplicável)</Label>
          <Input
            id="custom_color"
            placeholder="Ex: Pantone 485C, #FF0000, Azul Tiffany..."
            value={data.custom_color}
            onChange={(e) => update("custom_color", e.target.value)}
            className="h-11 focus-visible:ring-2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações sobre a personalização</Label>
          <Textarea
            id="notes"
            placeholder="Descreva detalhes da arte, textos na embalagem, posicionamento do logo, referências visuais..."
            rows={4}
            value={data.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Logo do cliente</Label>

          {data.logo_file ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-muted/30">
              {logoPreviewUrl ? (
                <img
                  src={logoPreviewUrl}
                  alt="Preview"
                  className="h-12 w-12 rounded object-contain"
                />
              ) : (
                <FileIcon className="h-12 w-12 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {data.logo_file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(data.logo_file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={removeLogo}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Arraste ou clique para enviar sua logo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, PDF ou CDR · Máximo 10MB
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} className="gap-2 h-11 font-semibold">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
