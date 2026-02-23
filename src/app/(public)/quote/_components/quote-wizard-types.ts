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
  /** URL da imagem da área de personalização — usada como fundo no editor DIY */
  print_area_image_url?: string | null;
}

export type ArtworkMode = "use_last" | "request_creation" | "do_it_yourself";

export type DiyPrintColor = "colorida" | "branca" | "preta";

export interface DiyCustomization {
  product_id: string;
  product_name: string;
  line1: string;
  line2: string;
  logo_file: File | null;
  logo_preview_url: string | null;
  print_color: DiyPrintColor;
}

export interface WizardPersonalization {
  artwork_mode: ArtworkMode | null;
  print_color: string;
  custom_color: string;
  notes: string;
  logo_file: File | null;
  diy_customizations: DiyCustomization[];
}

export type WizardStep =
  | "welcome"
  | "search"
  | "client-data"
  | "products"
  | "personalization"
  | "review";
