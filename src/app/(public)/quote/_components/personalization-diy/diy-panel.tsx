"use client";

import { DiyShortcuts } from "./diy-shortcuts";
import { DiyLogoUpload } from "./diy-logo-upload";
import { DiyColorSelector } from "./diy-color-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { DiyCustomization, WizardClientData } from "../quote-wizard-types";

interface DiyPanelProps {
  customization: DiyCustomization;
  clientData: WizardClientData;
  onChange: (updates: Partial<DiyCustomization>) => void;
}

const MAX_LINE_LENGTH = 50;

export function DiyPanel({ customization, clientData, onChange }: DiyPanelProps) {
  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      {/* Texto */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Texto da Personalização</Label>
          <span className="text-[10px] text-muted-foreground">
            Máx. {MAX_LINE_LENGTH} caracteres por linha
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Linha 1</label>
            <span
              className={`text-[10px] tabular-nums ${
                customization.line1.length > MAX_LINE_LENGTH
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {customization.line1.length}/{MAX_LINE_LENGTH}
            </span>
          </div>
          <Input
            placeholder="Ex: Dr. João Silva"
            value={customization.line1}
            onChange={(e) => {
              if (e.target.value.length <= MAX_LINE_LENGTH) {
                onChange({ line1: e.target.value });
              }
            }}
            className="font-medium"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Linha 2</label>
            <span
              className={`text-[10px] tabular-nums ${
                customization.line2.length > MAX_LINE_LENGTH
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {customization.line2.length}/{MAX_LINE_LENGTH}
            </span>
          </div>
          <Input
            placeholder="Ex: (11) 99999-8888"
            value={customization.line2}
            onChange={(e) => {
              if (e.target.value.length <= MAX_LINE_LENGTH) {
                onChange({ line2: e.target.value });
              }
            }}
          />
        </div>
      </div>

      <Separator />

      {/* Atalhos rápidos */}
      <DiyShortcuts
        clientData={clientData}
        onApply={(line1, line2) => {
          onChange({
            line1: line1.substring(0, MAX_LINE_LENGTH),
            line2: line2.substring(0, MAX_LINE_LENGTH),
          });
        }}
      />

      <Separator />

      {/* Logo */}
      <DiyLogoUpload
        logoFile={customization.logo_file}
        logoPreviewUrl={customization.logo_preview_url}
        onChange={(file, previewUrl) =>
          onChange({ logo_file: file, logo_preview_url: previewUrl })
        }
      />

      <Separator />

      {/* Cor de impressão */}
      <DiyColorSelector
        value={customization.print_color}
        onChange={(color) => onChange({ print_color: color })}
      />
    </div>
  );
}
