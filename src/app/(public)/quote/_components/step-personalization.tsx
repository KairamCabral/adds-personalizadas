"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  quotePersonalizationSchema,
  type QuotePersonalizationFormData,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/shared/file-upload";

const CORES = [
  { value: "1c", label: "1 cor" },
  { value: "2c", label: "2 cores" },
  { value: "4c", label: "4 cores" },
  { value: "full", label: "Full color" },
];

export interface PersonalizationData extends QuotePersonalizationFormData {
  logo_url?: string | null;
}

interface StepPersonalizationProps {
  initialData?: PersonalizationData;
  onNext: (data: PersonalizationData) => void;
  onBack: () => void;
  onLogoUpload?: (file: File) => Promise<string | null>;
}

export function StepPersonalization({
  initialData,
  onNext,
  onBack,
  onLogoUpload,
}: StepPersonalizationProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<QuotePersonalizationFormData>({
    resolver: zodResolver(quotePersonalizationSchema),
    defaultValues: {
      cor_impressao: initialData?.cor_impressao ?? "",
      notas_especiais: initialData?.notas_especiais ?? "",
      redes_sociais: initialData?.redes_sociais ?? "",
    },
  });

  const handleLogoUpload = (files: File[]) => {
    if (files.length === 0) {
      setLogoUrl(null);
      return;
    }
    if (!onLogoUpload) {
      setLogoUrl(null);
      return;
    }
    setUploading(true);
    onLogoUpload(files[0])
      .then((url) => setLogoUrl(url))
      .finally(() => setUploading(false));
  };

  const handleSubmit = (data: QuotePersonalizationFormData) => {
    onNext({ ...data, logo_url: logoUrl });
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="cor_impressao">Cor de impressão</Label>
        <Select
          value={form.watch("cor_impressao")}
          onValueChange={(v) => form.setValue("cor_impressao", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {CORES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="redes_sociais">Redes sociais</Label>
        <Input
          id="redes_sociais"
          placeholder="@usuario ou links"
          {...form.register("redes_sociais")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas_especiais">Notas especiais</Label>
        <Textarea
          id="notas_especiais"
          placeholder="Alguma observação ou preferência..."
          rows={4}
          {...form.register("notas_especiais")}
        />
      </div>

      <div className="space-y-2">
        <Label>Upload de logo</Label>
        <FileUpload
          accept="image/*"
          maxSize={5 * 1024 * 1024}
          onUpload={handleLogoUpload}
          disabled={uploading}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit">Próximo</Button>
      </div>
    </form>
  );
}
