"use client";

import { ArrowLeft, ArrowRight, Info, MapPin, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDocumentInput } from "@/lib/utils";
import { CepLookup } from "./cep-lookup";
import type { WizardClientData } from "./quote-wizard-types";

interface StepClientDataProps {
  data: WizardClientData;
  onChange: (data: WizardClientData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepClientData({
  data,
  onChange,
  onNext,
  onBack,
}: StepClientDataProps) {
  const update = (field: keyof WizardClientData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const isValid =
    data.client_name.trim().length >= 2 &&
    data.client_whatsapp.trim().length >= 8;

  const handleCepResult = (address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  }) => {
    onChange({
      ...data,
      client_street: address.street,
      client_neighborhood: address.neighborhood,
      client_city: address.city,
      client_state: address.state,
    });
  };

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Seus Dados</h2>
        <p className="text-muted-foreground">
          {data.is_existing_client
            ? "Confirme e complete seus dados abaixo"
            : "Preencha seus dados para o orçamento"}
        </p>
      </div>

      {data.from_search_prefill && (
        <div className="flex gap-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
          <Info className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Não encontramos seu CPF/CNPJ no cadastro ou você optou por atualizar o endereço. Complete os dados abaixo para continuar o orçamento.
          </p>
        </div>
      )}

      <Card className="rounded-xl border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Contato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              placeholder="Seu nome ou nome da empresa"
              value={data.client_name}
              onChange={(e) => update("client_name", e.target.value)}
              className="h-11 focus-visible:ring-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={data.client_email}
                onChange={(e) => update("client_email", e.target.value)}
                className="h-11 focus-visible:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input
                id="whatsapp"
                placeholder="(00) 00000-0000"
                value={data.client_whatsapp}
                onChange={(e) => update("client_whatsapp", e.target.value)}
                className="h-11 focus-visible:ring-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(00) 0000-0000"
                value={data.client_phone}
                onChange={(e) => update("client_phone", e.target.value)}
                className="h-11 focus-visible:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document">CPF ou CNPJ</Label>
              <Input
                id="document"
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                value={data.client_document}
                onChange={(e) => update("client_document", formatDocumentInput(e.target.value))}
                className="h-11 focus-visible:ring-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="social_media">Instagram ou site</Label>
            <Input
              id="social_media"
              placeholder="@suaempresa ou www.site.com.br"
              value={data.client_social_media}
              onChange={(e) => update("client_social_media", e.target.value)}
              className="h-11 focus-visible:ring-2"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        <CepLookup
          value={data.client_zip_code}
          onChange={(cep) => update("client_zip_code", cep)}
          onAddressFound={handleCepResult}
        />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={data.client_city}
                onChange={(e) => update("client_city", e.target.value)}
                className="h-11 focus-visible:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado (UF)</Label>
              <Input
                id="state"
                maxLength={2}
                placeholder="SP"
                value={data.client_state}
                onChange={(e) =>
                  update("client_state", e.target.value.toUpperCase())
                }
                className="h-11 focus-visible:ring-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="street">Rua</Label>
              <Input
                id="street"
                value={data.client_street}
                onChange={(e) => update("client_street", e.target.value)}
                className="h-11 focus-visible:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input
                id="number"
                value={data.client_number}
                onChange={(e) => update("client_number", e.target.value)}
                className="h-11 focus-visible:ring-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                value={data.client_neighborhood}
                onChange={(e) => update("client_neighborhood", e.target.value)}
                className="h-11 focus-visible:ring-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complement">Complemento</Label>
              <Input
                id="complement"
                placeholder="Sala 100, Bloco B..."
                value={data.client_complement}
                onChange={(e) => update("client_complement", e.target.value)}
                className="h-11 focus-visible:ring-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!isValid} className="gap-2 h-11 font-semibold">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
