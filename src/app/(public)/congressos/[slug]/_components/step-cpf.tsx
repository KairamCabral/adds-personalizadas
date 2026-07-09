"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface StepCpfProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  editionName: string;
  giftName: string | null;
}

export function StepCpf({
  value,
  onChange,
  onSubmit,
  loading,
  error,
  editionName,
  giftName,
}: StepCpfProps) {
  const digits = value.replace(/\D/g, "");
  const canSubmit = digits.length === 11 || digits.length === 14;

  return (
    <div className="mx-auto max-w-md space-y-8 text-center">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
          {editionName}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Retire seu brinde
        </h1>
        {giftName && <p className="text-base text-muted-foreground">{giftName}</p>}
        <p className="text-sm text-muted-foreground">
          Comece informando seu CPF ou CNPJ.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !loading) onSubmit();
        }}
        className="space-y-4"
      >
        <Input
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="000.000.000-00"
          className="h-14 text-center text-lg"
          aria-label="CPF ou CNPJ"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          size="lg"
          className="h-14 w-full text-base"
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Verificando...
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </form>
    </div>
  );
}
