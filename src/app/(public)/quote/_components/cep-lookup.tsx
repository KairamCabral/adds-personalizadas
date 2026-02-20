"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CepLookupProps {
  value: string;
  onChange: (cep: string) => void;
  onAddressFound: (address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  }) => void;
}

export function CepLookup({
  value,
  onChange,
  onAddressFound,
}: CepLookupProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCepChange = async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, "");
    const formatted =
      clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5, 8)}` : clean;
    onChange(formatted);

    if (clean.length === 8) {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${clean}/json/`
        );
        const data = await response.json();

        if (!data.erro) {
          onAddressFound({
            street: data.logradouro || "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: data.uf || "",
          });
        }
      } catch (error) {
        console.warn("CEP lookup failed:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="cep">CEP</Label>
      <div className="relative">
        <Input
          id="cep"
          placeholder="00000-000"
          maxLength={9}
          value={value}
          onChange={(e) => handleCepChange(e.target.value)}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
