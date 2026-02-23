"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { productSchema, type ProductFormData } from "@/lib/validations";
import type { Product } from "@/types/database.types";
import { Plus, X, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const DEFAULT_COLORS = [
  { key: "branco", label: "Branco", hex: "#FFFFFF", image_url: null },
  { key: "preto", label: "Preto", hex: "#000000", image_url: null },
];

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Product | null;
  onSubmit: (data: ProductFormData) => void;
  isLoading?: boolean;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isLoading,
}: ProductFormDialogProps) {
  const [addColorOpen, setAddColorOpen] = useState(false);
  const [newColorLabel, setNewColorLabel] = useState("");
  const [newColorHex, setNewColorHex] = useState("#000000");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingPrintArea, setUploadingPrintArea] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const printAreaInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      image_url: null,
      print_area_image_url: null,
      available_colors: [],
      is_active: true,
    },
  });

  const colors = form.watch("available_colors") ?? [];
  const imageUrl = form.watch("image_url");
  const printAreaImageUrl = form.watch("print_area_image_url");
  const isActive = form.watch("is_active") ?? true;

  useEffect(() => {
    if (open && initialData) {
      const rawColors = (initialData as any).available_colors;
      const parsed =
        Array.isArray(rawColors) && rawColors.length > 0
          ? rawColors.map((c: { key: string; label: string; hex?: string | null; image_url?: string | null }) => ({
              key: c.key,
              label: c.label,
              hex: c.hex ?? null,
              image_url: c.image_url ?? null,
            }))
          : DEFAULT_COLORS;
      form.reset({
        name: initialData.name,
        description: initialData.description ?? "",
        image_url: initialData.image_url ?? null,
        print_area_image_url: (initialData as any).print_area_image_url ?? null,
        available_colors: parsed,
        is_active: initialData.is_active ?? true,
      });
    } else if (open && !initialData) {
      form.reset({
        name: "",
        description: "",
        image_url: null,
        print_area_image_url: null,
        available_colors: [...DEFAULT_COLORS],
        is_active: true,
      });
    }
    // form é estável; incluir nas deps pode causar loop de re-renders (#310)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData]);

  const uploadImage = useCallback(async (file: File) => {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const allowedExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    if (!ACCEPTED_TYPES.includes(file.type) && !allowedExt.includes(ext)) {
      toast.error("Formato não suportado. Use JPG, PNG, GIF ou WebP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (initialData?.id) {
        formData.append("product_id", initialData.id);
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/products/upload-image", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao fazer upload");
      }

      const { url } = await res.json();
      form.setValue("image_url", url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao fazer upload");
    } finally {
      setUploadingImage(false);
    }
  }, [initialData?.id, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = "";
  };

  const removeImage = () => {
    form.setValue("image_url", null);
  };

  const uploadPrintAreaImage = useCallback(async (file: File) => {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const allowedExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    if (!ACCEPTED_TYPES.includes(file.type) && !allowedExt.includes(ext)) {
      toast.error("Formato não suportado. Use JPG, PNG, GIF ou WebP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    setUploadingPrintArea(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (initialData?.id) {
        formData.append("product_id", initialData.id);
      }
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/products/upload-image", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao fazer upload");
      }
      const { url } = await res.json();
      form.setValue("print_area_image_url", url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao fazer upload");
    } finally {
      setUploadingPrintArea(false);
    }
  }, [initialData?.id, form]);

  const removePrintAreaImage = () => {
    form.setValue("print_area_image_url", null);
  };

  const addColor = () => {
    const label = newColorLabel.trim();
    if (!label) return;
    const key = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
    if (colors.some((c) => c.key === key)) return;
    form.setValue("available_colors", [
      ...colors,
      { key, label, hex: newColorHex || null, image_url: null },
    ]);
    setNewColorLabel("");
    setNewColorHex("#000000");
    setAddColorOpen(false);
  };

  const removeColor = (key: string) => {
    form.setValue(
      "available_colors",
      colors.filter((c) => c.key !== key)
    );
  };

  const uploadColorImage = useCallback(
    async (colorKey: string, file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error("Formato não suportado. Use JPG, PNG, GIF ou WebP.");
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error("Arquivo muito grande. Máximo 5MB.");
        return;
      }
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (initialData?.id) {
          formData.append("product_id", initialData.id);
        }
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch("/api/products/upload-image", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erro ao fazer upload");
        }
        const { url } = await res.json();
        const next = colors.map((c) =>
          c.key === colorKey ? { ...c, image_url: url } : c
        );
        form.setValue("available_colors", next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao fazer upload");
      } finally {
        setUploadingImage(false);
      }
    },
    [initialData?.id, colors, form]
  );

  const removeColorImage = (colorKey: string) => {
    const next = colors.map((c) =>
      c.key === colorKey ? { ...c, image_url: null } : c
    );
    form.setValue("available_colors", next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar produto" : "Novo produto"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Nome do produto"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Breve descrição do produto"
              rows={3}
            />
          </div>

          {/* Imagem do produto */}
          <div className="space-y-2">
            <Label>Imagem do produto</Label>
            {imageUrl ? (
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Imagem carregada</p>
                  <p className="text-xs text-muted-foreground">
                    Clique em remover para trocar
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeImage}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="mr-1 h-4 w-4" />
                  Remover
                </Button>
              </div>
            ) : (
              <div
                onClick={() => !uploadingImage && inputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 py-8 transition-colors hover:border-primary/30 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {uploadingImage ? "Enviando..." : "Arraste a imagem ou clique para selecionar"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, GIF ou WebP · Máximo 5MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploadingImage}
                />
              </div>
            )}
          </div>

          {/* Imagem da área de personalização */}
          <div className="space-y-2">
            <Label>Imagem da área de personalização</Label>
            <p className="text-xs text-muted-foreground">
              Foto do local onde a personalização será impressa. Usada como fundo no editor &quot;Faça você mesmo&quot;.
            </p>
            {printAreaImageUrl ? (
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <img
                  src={printAreaImageUrl}
                  alt="Área de personalização"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Imagem carregada</p>
                  <p className="text-xs text-muted-foreground">
                    Clique em remover para trocar
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removePrintAreaImage}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="mr-1 h-4 w-4" />
                  Remover
                </Button>
              </div>
            ) : (
              <div
                onClick={() => !uploadingPrintArea && printAreaInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 py-8 transition-colors hover:border-primary/30 hover:bg-muted/50"
              >
                <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {uploadingPrintArea ? "Enviando..." : "Arraste a imagem ou clique para selecionar"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, GIF ou WebP · Máximo 5MB
                </p>
                <input
                  ref={printAreaInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPrintAreaImage(file);
                    e.target.value = "";
                  }}
                  className="hidden"
                  disabled={uploadingPrintArea}
                />
              </div>
            )}
          </div>

          {/* Cores disponíveis */}
          <div className="space-y-3">
            <Label>Cores disponíveis</Label>
            <p className="text-xs text-muted-foreground">
              Adicione uma imagem para cada variação de cor. Se não houver imagem, será usada a imagem principal do produto.
            </p>
            <div className="space-y-2">
              {colors.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <span
                    className="h-8 w-8 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: c.hex ?? "transparent" }}
                  />
                  <span className="min-w-[80px] text-sm font-medium">{c.label}</span>
                  <div className="flex flex-1 items-center gap-2">
                    {(c as { image_url?: string | null }).image_url ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={(c as { image_url?: string }).image_url!}
                          alt={c.label}
                          className="h-12 w-12 rounded-lg object-cover ring-1 ring-border/50"
                        />
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = ACCEPTED_TYPES.join(",");
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) uploadColorImage(c.key, file);
                              };
                              input.click();
                            }}
                            disabled={uploadingImage}
                          >
                            Trocar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:text-destructive"
                            onClick={() => removeColorImage(c.key)}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          if (uploadingImage) return;
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = ACCEPTED_TYPES.join(",");
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) uploadColorImage(c.key, file);
                          };
                          input.click();
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingImage ? "Enviando..." : "Adicionar imagem"}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeColor(c.key)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remover cor ${c.label}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {addColorOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nome da cor"
                  value={newColorLabel}
                  onChange={(e) => setNewColorLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColor())}
                  className="max-w-[140px]"
                />
                <Input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="h-9 w-14 cursor-pointer p-1"
                />
                <Button type="button" size="sm" onClick={addColor}>
                  OK
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddColorOpen(false);
                    setNewColorLabel("");
                    setNewColorHex("#000000");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-dashed"
                onClick={() => setAddColorOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Adicionar cor
              </Button>
            )}
          </div>

          {/* Produto ativo */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="is_active" className="cursor-pointer">
                Produto ativo
              </Label>
              <p className="text-xs text-muted-foreground">
                Produtos inativos não aparecem na seleção de pedidos
              </p>
            </div>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(v) => form.setValue("is_active", v)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : initialData ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
