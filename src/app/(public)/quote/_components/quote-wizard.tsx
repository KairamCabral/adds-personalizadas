"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createPublicQuote,
  uploadQuoteLogo,
  getActiveProducts,
  type CreatePublicQuoteData,
} from "@/services/quotes.service";
import { WizardProgress } from "./wizard-progress";
import { StepWelcome } from "./step-welcome";
import { StepSearch } from "./step-search";
import { StepClientData } from "./step-client-data";
import { StepProducts } from "./step-products";
import { StepPersonalization } from "./step-personalization";
import { StepReview } from "./step-review";
import type {
  WizardClientData,
  WizardProductItem,
  WizardPersonalization,
  WizardStep,
} from "./quote-wizard-types";

export type { WizardClientData, WizardProductItem, WizardPersonalization, WizardStep, ArtworkMode } from "./quote-wizard-types";

const STEP_ORDER: WizardStep[] = [
  "welcome",
  "search",
  "client-data",
  "products",
  "personalization",
  "review",
];
const STEP_LABELS: Record<WizardStep, string> = {
  welcome: "Início",
  search: "Buscar",
  "client-data": "Seus Dados",
  products: "Produtos",
  personalization: "Personalização",
  review: "Revisão",
};

const INITIAL_CLIENT: WizardClientData = {
  client_name: "",
  client_email: "",
  client_phone: "",
  client_whatsapp: "",
  client_document: "",
  client_city: "",
  client_state: "",
  client_zip_code: "",
  client_street: "",
  client_number: "",
  client_complement: "",
  client_neighborhood: "",
  client_social_media: "",
  is_existing_client: false,
  existing_client_id: null,
};

const INITIAL_PERSONALIZATION: WizardPersonalization = {
  artwork_mode: null,
  print_color: "",
  custom_color: "",
  notes: "",
  logo_file: null,
};

export function QuoteWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [clientData, setClientData] = useState<WizardClientData>(INITIAL_CLIENT);
  const [products, setProducts] = useState<WizardProductItem[]>([]);
  const [personalization, setPersonalization] =
    useState<WizardPersonalization>(INITIAL_PERSONALIZATION);

  const { data: productCatalog = [] } = useQuery({
    queryKey: ["public-products"],
    queryFn: getActiveProducts,
  });

  const goTo = (step: WizardStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      goTo(STEP_ORDER[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      goTo(STEP_ORDER[currentIndex - 1]);
    }
  };

  const handleWelcome = (isExistingClient: boolean) => {
    if (isExistingClient) {
      goTo("search");
    } else {
      setClientData({ ...INITIAL_CLIENT, is_existing_client: false });
      goTo("client-data");
    }
  };

  const handleClientFound = (
    data: Partial<WizardClientData> & {
      is_existing_client: true;
      existing_client_id: string | null;
    }
  ) => {
    setClientData({
      ...INITIAL_CLIENT,
      ...data,
      is_existing_client: true,
    });
    goTo("products");
  };

  const handleClientNotFound = (payload: {
    client_name: string;
    client_document: string;
  }) => {
    setClientData({
      ...INITIAL_CLIENT,
      is_existing_client: false,
      from_search_prefill: true,
      client_name: payload.client_name,
      client_document: payload.client_document,
    });
    goTo("client-data");
  };

  const handleAddressIncorrect = (payload: {
    client_name: string;
    client_document: string;
  }) => {
    setClientData({
      ...INITIAL_CLIENT,
      is_existing_client: false,
      from_search_prefill: true,
      client_name: payload.client_name,
      client_document: payload.client_document,
    });
    goTo("client-data");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let logoUrl: string | undefined;
      if (personalization.logo_file) {
        logoUrl = await uploadQuoteLogo(personalization.logo_file);
      }

      const quoteData: CreatePublicQuoteData = {
        client_name: clientData.client_name,
        client_email: clientData.client_email || undefined,
        client_phone: clientData.client_phone || undefined,
        client_whatsapp: clientData.client_whatsapp || undefined,
        client_document: clientData.client_document || undefined,
        client_city: clientData.client_city || undefined,
        client_state: clientData.client_state || undefined,
        client_zip_code: clientData.client_zip_code || undefined,
        client_street: clientData.client_street || undefined,
        client_number: clientData.client_number || undefined,
        client_complement: clientData.client_complement || undefined,
        client_neighborhood: clientData.client_neighborhood || undefined,
        client_social_media: clientData.client_social_media || undefined,
        client_logo_url: logoUrl,
        is_existing_client: clientData.is_existing_client,
        existing_client_id: clientData.existing_client_id || undefined,
        items: products.map((p) => {
          const total = p.quantity_per_color && Object.keys(p.quantity_per_color).length > 0
            ? Object.values(p.quantity_per_color).reduce((a, b) => a + b, 0)
            : p.quantity;
          return {
            product_id: p.product_id,
            product_name: p.product_name,
            quantity: total,
            colors: p.colors,
            custom_color: p.custom_color,
            ...(p.quantity_per_color && Object.keys(p.quantity_per_color).length > 0
              ? { quantity_per_color: p.quantity_per_color }
              : {}),
          };
        }),
        personalization: {
          artwork_mode: personalization.artwork_mode ?? undefined,
          print_color: personalization.print_color || undefined,
          custom_color: personalization.custom_color || undefined,
          notes: personalization.notes || undefined,
        },
      };

      await createPublicQuote(quoteData);
      router.push("/quote/success");
    } catch (error) {
      console.error("Erro ao enviar orçamento:", error);
      toast.error("Erro ao enviar orçamento", {
        description:
          "Tente novamente. Se o problema persistir, entre em contato conosco.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressSteps: WizardStep[] = [
    "client-data",
    "products",
    "personalization",
    "review",
  ];
  const currentProgressIndex = progressSteps.indexOf(currentStep);

  return (
    <div className="space-y-8 sm:space-y-10 w-full max-w-full min-w-0">
      {currentProgressIndex >= 0 && (
        <WizardProgress
          steps={progressSteps.map((s) => STEP_LABELS[s])}
          currentIndex={currentProgressIndex}
        />
      )}

      {currentStep === "welcome" && (
        <StepWelcome onSelect={handleWelcome} />
      )}

      {currentStep === "search" && (
        <StepSearch
          onClientFound={handleClientFound}
          onClientNotFound={handleClientNotFound}
          onAddressIncorrect={handleAddressIncorrect}
          onBack={() => goTo("welcome")}
        />
      )}

      {currentStep === "client-data" && (
        <StepClientData
          data={clientData}
          onChange={setClientData}
          onNext={() => goTo("products")}
          onBack={() =>
            goTo(
              clientData.is_existing_client || clientData.from_search_prefill
                ? "search"
                : "welcome"
            )
          }
        />
      )}

      {currentStep === "products" && (
        <StepProducts
          selectedProducts={products}
          onChange={setProducts}
          onNext={() => goTo("personalization")}
          onBack={() => goTo("client-data")}
        />
      )}

      {currentStep === "personalization" && (
        <StepPersonalization
          data={personalization}
          onChange={setPersonalization}
          onNext={() => goTo("review")}
          onBack={() => goTo("products")}
          isExistingClient={clientData.is_existing_client}
        />
      )}

      {currentStep === "review" && (
        <StepReview
          clientData={clientData}
          products={products}
          productCatalog={productCatalog as { id: string; name: string; price: number | null; category?: string | null }[]}
          personalization={personalization}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onBack={() => goTo("personalization")}
          onEditClient={() => goTo("client-data")}
          onEditProducts={() => goTo("products")}
          onEditPersonalization={() => goTo("personalization")}
        />
      )}
    </div>
  );
}
