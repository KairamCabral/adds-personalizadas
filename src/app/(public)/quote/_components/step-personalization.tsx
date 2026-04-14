"use client";

import {
  ArrowLeft,
  ArrowRight,
  Copy,
  FileIcon,
  Loader2,
  Palette,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  ArtworkMode,
  WizardPersonalization,
  WizardProductItem,
  WizardClientData,
} from "./quote-wizard-types";
import { DiyEditor } from "./personalization-diy/diy-editor";

const ACCEPTED_TYPES = ".jpg,.jpeg,.png,.pdf,.cdr";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const ARTWORK_OPTIONS: {
  value: ArtworkMode;
  label: string;
  description: string;
  icon: typeof Copy;
  badge?: string;
  disabled?: boolean;
  requireAuth?: boolean;
}[] = [
  {
    value: "use_last",
    label: "Usar última arte",
    description: "Reutilizar arte de um pedido anterior",
    icon: Copy,
  },
  {
    value: "request_creation",
    label: "Solicitar criação da arte",
    description: "Nossa equipe cria a arte para você",
    icon: Palette,
    badge: "Mais usado",
  },
  {
    value: "do_it_yourself",
    label: "Faça você mesmo",
    description: "Personalize agora e veja o resultado",
    icon: Sparkles,
    badge: "Novo",
    /** Em desenvolvimento: só com sessão CRM (mesmo cookie em /quote) */
    requireAuth: true,
  },
];

interface StepPersonalizationProps {
  data: WizardPersonalization;
  onChange: (data: WizardPersonalization) => void;
  products: WizardProductItem[];
  clientData: WizardClientData;
  onNext: () => void;
  onBack: () => void;
  /** Cliente encontrado no Tiny (tem pedidos anteriores). Se false, oculta "Usar última arte". */
  isExistingClient?: boolean;
}

export function StepPersonalization({
  data,
  onChange,
  products,
  clientData,
  onNext,
  onBack,
  isExistingClient = false,
}: StepPersonalizationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  /** null = ainda verificando sessão; true = logado no CRM */
  const [hasCrmSession, setHasCrmSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setHasCrmSession(!!session?.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasCrmSession(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const update = (field: keyof WizardPersonalization, value: string | File | null) => {
    onChange({ ...data, [field]: value });
  };

  const handleSelectMode = (mode: ArtworkMode) => {
    if (mode === "do_it_yourself") {
      onChange({ ...data, artwork_mode: mode });
      return;
    }
    if (mode === "use_last") {
      onChange({ ...data, artwork_mode: mode, notes: "Será a mesma arte" });
      onNext();
      return;
    }
    // Ao escolher "Solicitar criação", limpar notas de "use_last" para exibir o placeholder correto
    if (mode === "request_creation" && data.notes === "Será a mesma arte") {
      onChange({ ...data, artwork_mode: mode, notes: "" });
    } else {
      onChange({ ...data, artwork_mode: mode });
    }
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

  const handleNext = () => {
    onNext();
  };

  const canUseDiy = hasCrmSession === true;

  useEffect(() => {
    if (hasCrmSession === false && data.artwork_mode === "do_it_yourself") {
      onChange({
        ...data,
        artwork_mode: null,
        diy_customizations: [],
      });
    }
  }, [hasCrmSession, data.artwork_mode, onChange, data]);

  if (data.artwork_mode === "do_it_yourself") {
    if (hasCrmSession === null) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm">Verificando acesso…</p>
        </div>
      );
    }
    if (!canUseDiy) {
      return (
        <div className="flex min-h-[32vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
          <p>Esta opção está disponível apenas com login no sistema.</p>
          <p className="text-xs">Voltando à escolha de personalização…</p>
        </div>
      );
    }
    return (
      <DiyEditor
        products={products}
        clientData={clientData}
        data={data}
        onChange={onChange}
        onNext={onNext}
        onBack={() => onChange({ ...data, artwork_mode: null })}
      />
    );
  }

  if (!data.artwork_mode) {
    return (
      <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Como deseja personalizar?
          </h2>
          <p className="text-muted-foreground">
            Escolha a opção que melhor se encaixa no seu pedido
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Modo de personalização"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {ARTWORK_OPTIONS.filter(
            (o) =>
              (o.value !== "use_last" || isExistingClient) &&
              (!o.requireAuth || canUseDiy),
          ).map((option) => {
            const Icon = option.icon;
            const isSelected = data.artwork_mode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-describedby={`desc-${option.value}`}
                disabled={option.disabled}
                onClick={() => handleSelectMode(option.value)}
                className={cn(
                  "group relative flex flex-col items-start gap-4 rounded-xl border-2 p-6 sm:p-7 text-left transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  option.disabled
                    ? "cursor-not-allowed border-border bg-muted/30 opacity-60"
                    : isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50 hover:bg-muted/30 hover:shadow-sm"
                )}
              >
                {option.badge && (
                  <span
                    className={cn(
                      "absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold",
                      option.disabled
                        ? "bg-muted text-muted-foreground"
                        : option.badge === "Mais usado"
                          ? "bg-primary/20 text-primary"
                          : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {option.badge}
                  </span>
                )}
                <div
                  className={cn(
                    "flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-lg transition-colors",
                    option.disabled
                      ? "bg-muted text-muted-foreground"
                      : isSelected
                        ? "bg-primary/20 text-primary"
                        : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}
                >
                  <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-base sm:text-lg font-semibold leading-tight">{option.label}</p>
                  <p
                    id={`desc-${option.value}`}
                    className="text-sm sm:text-base text-muted-foreground leading-snug"
                  >
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (data.artwork_mode === "use_last") {
    return (
      <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Usar última arte
          </h2>
          <p className="text-muted-foreground">
            Será utilizada a mesma arte do pedido anterior.
          </p>
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="ghost"
            onClick={() => onChange({ ...data, artwork_mode: null })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button
            onClick={onNext}
            className="gap-2 h-11 font-semibold"
          >
            Próximo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Solicitar criação da arte
        </h2>
        <p className="text-muted-foreground">
          Informe os detalhes da personalização e anexe sua logo
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="notes">Informações sobre a personalização</Label>
          <Textarea
            id="notes"
            placeholder={"Exemplo:\nLinha 1: logo + nome\nLinha 2: telefone 1 + telefone 2"}
            rows={4}
            value={data.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="resize-none"
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
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
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
                PDF, PNG, CDR ou JPG · Máximo 10MB
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
        <Button
          variant="ghost"
          onClick={() => onChange({ ...data, artwork_mode: null })}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={handleNext} className="gap-2 h-11 font-semibold">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
