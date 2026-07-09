"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { CONSENT_TEXT } from "@/lib/congressos/consent";

export function ConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3 text-left text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
        aria-label="Aceito o tratamento dos meus dados"
      />
      <span className="text-muted-foreground">{CONSENT_TEXT}</span>
    </label>
  );
}
