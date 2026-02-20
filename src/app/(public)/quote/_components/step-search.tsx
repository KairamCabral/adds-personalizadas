"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDocumentInput } from "@/lib/utils";
import type { WizardClientData } from "./quote-wizard-types";

/** Retorna só os dígitos do documento para busca consistente */
function normalizeDocument(doc: string): string {
  return (doc || "").replace(/\D/g, "");
}

interface CrmClient {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

interface StepSearchProps {
  onClientFound: (
    data: Partial<WizardClientData> & { is_existing_client: true; existing_client_id: string | null }
  ) => void;
  onClientNotFound: (payload: { client_name: string; client_document: string }) => void;
  onAddressIncorrect: (payload: { client_name: string; client_document: string }) => void;
  onBack: () => void;
}

type Screen = "form" | "address-confirm" | "not-found";

export function StepSearch({
  onClientFound,
  onClientNotFound,
  onAddressIncorrect,
  onBack,
}: StepSearchProps) {
  const [clientName, setClientName] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [screen, setScreen] = useState<Screen>("form");
  const [foundClient, setFoundClient] = useState<CrmClient | null>(null);

  const handleSubmit = async () => {
    const name = clientName.trim();
    const docNorm = normalizeDocument(clientDocument);
    if (!name || name.length < 2) return;
    if (docNorm.length < 11) return; // CPF 11 ou CNPJ 14

    setIsSearching(true);
    setScreen("form");

    try {
      const res = await fetch(
        `/api/clients/find-by-document?document=${encodeURIComponent(clientDocument)}`
      );
      const json = await res.json();
      const client = json?.client ?? null;

      if (!client) {
        setScreen("not-found");
        setFoundClient(null);
        return;
      }

      setFoundClient(client as CrmClient);
      setScreen("address-confirm");
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      setScreen("not-found");
      setFoundClient(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmAddress = () => {
    if (!foundClient) return;
    onClientFound({
      client_name: foundClient.name,
      client_email: foundClient.email || "",
      client_phone: foundClient.phone || "",
      client_whatsapp: foundClient.phone || "",
      client_document: foundClient.document || "",
      client_city: foundClient.city || "",
      client_state: foundClient.state || "",
      client_zip_code: foundClient.zip_code || "",
      client_street: foundClient.street || "",
      client_number: foundClient.number || "",
      client_complement: foundClient.complement || "",
      client_neighborhood: foundClient.neighborhood || "",
      client_social_media: "",
      is_existing_client: true,
      existing_client_id: foundClient.id,
    });
  };

  const handleAddressIncorrectClick = () => {
    if (!foundClient) return;
    onAddressIncorrect({
      client_name: foundClient.name,
      client_document: foundClient.document || clientDocument.trim(),
    });
  };

  const handleContinueRegister = () => {
    onClientNotFound({
      client_name: clientName.trim(),
      client_document: clientDocument.trim(),
    });
  };

  const docNorm = normalizeDocument(clientDocument);
  const canSubmit =
    clientName.trim().length >= 2 && (docNorm.length === 11 || docNorm.length === 14);

  if (screen === "address-confirm" && foundClient) {
    const previewParts = [
      foundClient.neighborhood,
      foundClient.city,
      foundClient.state,
    ].filter(Boolean);
    const addressPreview =
      previewParts.length >= 2
        ? `${previewParts[0]}, ${previewParts[1]} – ${previewParts[2] || ""}`.trim()
        : previewParts.join(", ") || "Bairro, cidade e estado do último pedido";

    return (
      <div className="space-y-8 w-full max-w-5xl mx-auto">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Confirme seu endereço</h2>
          <p className="text-muted-foreground">
            Encontramos seu cadastro. Abaixo estão o <strong>bairro, a cidade e o estado</strong> do seu último pedido — confira se está correto.
          </p>
        </div>

        <Card className="rounded-xl border-2 shadow-lg">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-muted-foreground">Bairro, cidade e estado do último pedido</p>
                <p className="mt-1 font-semibold text-lg">{addressPreview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-muted-foreground font-medium">
          Este endereço (bairro, cidade e estado) está correto e é o mesmo do seu último pedido?
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleConfirmAddress} className="flex-1 h-11 font-semibold">
            Sim, está correto
          </Button>
          <Button variant="outline" onClick={handleAddressIncorrectClick} className="flex-1 h-11">
            Não, preciso alterar
          </Button>
        </div>

        <Button variant="ghost" onClick={() => setScreen("form")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  if (screen === "not-found") {
    return (
      <div className="space-y-8 w-full max-w-5xl mx-auto">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Cadastro não encontrado</h2>
          <p className="text-muted-foreground">
            Não encontramos seu CPF/CNPJ em nossa base. Você pode continuar o cadastro com os dados
            informados.
          </p>
        </div>

        <Card className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Complete seus dados no próximo passo para solicitar seu orçamento.
          </p>
          <Button onClick={handleContinueRegister} className="font-semibold">
            Continuar cadastro
          </Button>
        </Card>

        <Button variant="ghost" onClick={() => setScreen("form")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Buscar seus dados</h2>
        <p className="text-muted-foreground">
          Informe seu nome e CPF/CNPJ para buscarmos seu cadastro no nosso sistema
        </p>
      </div>

      <Card className="rounded-xl border-2 p-6">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="space-y-2">
            <label htmlFor="search-name" className="text-sm font-medium">
              Nome completo *
            </label>
            <Input
              id="search-name"
              placeholder="Seu nome ou nome da empresa"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={isSearching}
              className="h-11 focus-visible:ring-2"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="search-document" className="text-sm font-medium">
              CPF ou CNPJ *
            </label>
            <Input
              id="search-document"
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
              value={clientDocument}
              onChange={(e) => setClientDocument(formatDocumentInput(e.target.value))}
              disabled={isSearching}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="h-11 focus-visible:ring-2"
            />
          </div>
          <Button
            type="submit"
            disabled={!canSubmit || isSearching}
            className="h-11 font-semibold w-full sm:w-auto"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Buscando...
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </form>
      </Card>

      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
    </div>
  );
}
