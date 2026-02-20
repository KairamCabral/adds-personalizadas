export interface WizardClientData {
  client_name: string;
  client_email: string;
  client_phone: string;
  client_whatsapp: string;
  client_document: string;
  client_city: string;
  client_state: string;
  client_zip_code: string;
  client_street: string;
  client_number: string;
  client_complement: string;
  client_neighborhood: string;
  client_social_media: string;
  is_existing_client: boolean;
  existing_client_id: string | null;
  /** Indica que nome/documento vieram da tela "Já sou cliente" (não encontrado ou alterar endereço) */
  from_search_prefill?: boolean;
}

export interface WizardProductItem {
  product_id: string;
  product_name: string;
  /** Quantidade total (usado quando não há quantity_per_color ou como fallback) */
  quantity: number;
  colors: string[];
  custom_color: string | null;
  /**
   * Quantidade por cor (corKey -> quantidade).
   * Quando definido, prevalece sobre quantity: total = soma dos valores.
   * Permite mesma quantidade para todas (ex.: 100 cada) ou quantidades diferentes por cor.
   */
  quantity_per_color?: Record<string, number>;
}

export interface WizardPersonalization {
  print_color: string;
  custom_color: string;
  notes: string;
  logo_file: File | null;
}

export type WizardStep =
  | "welcome"
  | "search"
  | "client-data"
  | "products"
  | "personalization"
  | "review";
