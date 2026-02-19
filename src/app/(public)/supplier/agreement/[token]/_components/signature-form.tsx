"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { isValidCPF } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

function formatCPFInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const signatureSchema = z
  .object({
    agreed: z.boolean().refine((v) => v === true, {
      message: "Você precisa concordar com os termos para assinar.",
    }),
    name: z.string().min(1, "Nome é obrigatório"),
    role: z.string().min(1, "Cargo é obrigatório"),
    document: z.string().min(1, "CPF é obrigatório"),
  })
  .refine((data) => isValidCPF(data.document.replace(/\D/g, "")), {
    message: "CPF inválido",
    path: ["document"],
  });

type SignatureFormData = z.infer<typeof signatureSchema>;

interface SignatureFormProps {
  token: string;
}

export function SignatureForm({ token }: SignatureFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{
    signedAt: string;
    signerName: string;
    agreementHash?: string;
  } | null>(null);

  const form = useForm<SignatureFormData>({
    resolver: zodResolver(signatureSchema),
    defaultValues: {
      agreed: false,
      name: "",
      role: "",
      document: "",
    },
  });

  async function onSubmit(data: SignatureFormData) {
    setIsLoading(true);
    try {
      let ip: string | undefined;
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipJson = await ipRes.json();
        ip = ipJson.ip;
      } catch {
        ip = undefined;
      }

      const userAgent =
        typeof navigator !== "undefined" ? navigator.userAgent : undefined;

      const res = await fetch("/api/supplier/agreement/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: data.name,
          role: data.role,
          document: data.document.replace(/\D/g, ""),
          ip,
          userAgent,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error ?? "Erro ao assinar termo.");
      }

      setSuccessData({
        signedAt: result.signed_at ?? new Date().toISOString(),
        signerName: data.name,
        agreementHash: result.agreement_hash,
      });
      setIsSuccess(true);
      toast.success("Termo assinado com sucesso!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao assinar termo."
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess && successData) {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
        <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-8 w-8 shrink-0" />
          <div>
            <h3 className="font-semibold">Termo assinado com sucesso</h3>
            <p className="mt-1 text-sm">
              Assinado em {formatDate(successData.signedAt)} por{" "}
              {successData.signerName}
            </p>
            {successData.agreementHash && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Hash: {successData.agreementHash.slice(0, 16)}...
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mt-6 space-y-4"
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id="agreed"
          checked={form.watch("agreed")}
          onCheckedChange={(checked) =>
            form.setValue("agreed", checked === true)
          }
        />
        <Label
          htmlFor="agreed"
          className="cursor-pointer text-sm leading-tight text-muted-foreground"
        >
          Li e concordo com todos os termos acima
        </Label>
      </div>
      {form.formState.errors.agreed && (
        <p className="text-xs text-destructive">
          {form.formState.errors.agreed.message}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome completo do signatário</Label>
        <Input
          id="name"
          placeholder="Seu nome completo"
          {...form.register("name")}
          className={form.formState.errors.name ? "border-destructive" : ""}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Cargo/função</Label>
        <Input
          id="role"
          placeholder="Ex: Diretor, Gerente"
          {...form.register("role")}
          className={form.formState.errors.role ? "border-destructive" : ""}
        />
        {form.formState.errors.role && (
          <p className="text-xs text-destructive">
            {form.formState.errors.role.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="document">CPF</Label>
        <Input
          id="document"
          placeholder="000.000.000-00"
          {...form.register("document")}
          onChange={(e) => {
            const formatted = formatCPFInput(e.target.value);
            form.setValue("document", formatted, { shouldValidate: true });
          }}
          className={form.formState.errors.document ? "border-destructive" : ""}
        />
        {form.formState.errors.document && (
          <p className="text-xs text-destructive">
            {form.formState.errors.document.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Assinando...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Assinar Termo
          </>
        )}
      </Button>
    </form>
  );
}
