"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { createPublicQuote } from "@/services/quotes.service";
import type { QuoteRegisterFormData } from "@/lib/validations";
import type { QuoteItem } from "./step-products";
import type { PersonalizationData } from "./step-personalization";
import { StepWelcome } from "./step-welcome";
import { StepRegister } from "./step-register";
import { StepProducts } from "./step-products";
import { StepPersonalization } from "./step-personalization";
import { StepConfirmation } from "./step-confirmation";

const TOTAL_STEPS = 5;

export function QuoteWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [registerData, setRegisterData] = useState<QuoteRegisterFormData | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [personalization, setPersonalization] = useState<PersonalizationData | null>(null);

  const handleNext = () => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleEdit = (targetStep: number) => {
    setStep(targetStep);
  };

  const handleRegisterNext = (data: QuoteRegisterFormData) => {
    setRegisterData(data);
    handleNext();
  };

  const handleProductsNext = (newItems: QuoteItem[], newTotal: number) => {
    setItems(newItems);
    setTotal(newTotal);
    handleNext();
  };

  const handlePersonalizationNext = (data: PersonalizationData) => {
    setPersonalization(data);
    handleNext();
  };

  const uploadLogo = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/quote/upload-logo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload falhou");
      const { url } = await res.json();
      return url ?? null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!registerData || items.length === 0) {
      toast.error("Dados incompletos.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPublicQuote({
        client_name: registerData.nome,
        client_email: registerData.email,
        client_phone: registerData.telefone,
        client_whatsapp: registerData.whatsapp || null,
        client_document: registerData.cpf_cnpj || null,
        client_city: registerData.cidade,
        client_state: registerData.estado,
        client_zip_code: registerData.cep,
        client_street: registerData.rua,
        client_number: registerData.numero,
        client_neighborhood: registerData.bairro,
        client_social_media: personalization?.redes_sociais || null,
        client_logo_url: personalization?.logo_url || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        personalization: personalization
          ? {
              cor_impressao: personalization.cor_impressao,
              notas_especiais: personalization.notas_especiais,
            }
          : null,
        estimated_value: total,
      });
      toast.success("Orçamento enviado com sucesso!");
      router.push("/quote/success");
    } catch {
      toast.error("Erro ao enviar orçamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Solicitar Orçamento
        </h1>
        <p className="mt-1 text-muted-foreground">
          Passo {step} de {TOTAL_STEPS}
        </p>
        <Progress value={(step / TOTAL_STEPS) * 100} className="mt-4" />
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {step === 1 && <StepWelcome onNext={handleNext} />}
        {step === 2 && (
          <StepRegister
            initialData={registerData ?? undefined}
            onNext={handleRegisterNext}
            onBack={handleBack}
          />
        )}
        {step === 3 && (
          <StepProducts
            initialItems={items}
            onNext={handleProductsNext}
            onBack={handleBack}
          />
        )}
        {step === 4 && (
          <StepPersonalization
            initialData={personalization ?? undefined}
            onNext={handlePersonalizationNext}
            onBack={handleBack}
            onLogoUpload={uploadLogo}
          />
        )}
        {step === 5 && registerData && personalization && (
          <StepConfirmation
            registerData={registerData}
            items={items}
            total={total}
            personalization={personalization}
            onEdit={handleEdit}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
