import { describe, it, expect } from "vitest";
import { congressoRegisterSchema } from "./validations";

/**
 * Regressão do PR #87: a exigência de telefone foi aplicada a TODO payload,
 * mas o confirm de cliente existente (congresso-wizard `handleConfirm`) não
 * envia `phone` — o servidor usa o telefone do cliente. Resultado: todo
 * cliente já cadastrado no CRM recebia 400 "Dados inválidos" ao se inscrever.
 */
const base = {
  slug: "in26",
  document: "529.982.247-25",
  consent: true as const,
  consent_version: "v1",
  idempotency_key: "idem-1",
};

function phoneIssue(payload: Record<string, unknown>) {
  const res = congressoRegisterSchema.safeParse(payload);
  if (res.success) return null;
  return res.error.issues.find((i) => i.path[0] === "phone") ?? null;
}

describe("congressoRegisterSchema — telefone", () => {
  describe("cadastro novo", () => {
    const novo = { ...base, is_existing_client: false, name: "Ana Souza" };

    it("aceita celular válido", () => {
      expect(phoneIssue({ ...novo, phone: "(47) 99187-8070" })).toBeNull();
    });

    it("recusa sem telefone", () => {
      expect(phoneIssue({ ...novo, phone: null })).not.toBeNull();
      expect(phoneIssue(novo)).not.toBeNull();
    });

    it("recusa telefone falso", () => {
      expect(phoneIssue({ ...novo, phone: "(11) 99999-9999" })).not.toBeNull();
    });
  });

  describe("confirm de cliente existente", () => {
    const existente = {
      ...base,
      is_existing_client: true,
      existing_client_id: "11111111-1111-4111-8111-111111111111",
    };

    it("aceita SEM telefone no payload (o servidor usa o do cliente)", () => {
      // Exatamente o payload do handleConfirm do wizard.
      const res = congressoRegisterSchema.safeParse(existente);
      expect(res.success).toBe(true);
    });

    it("se o telefone vier informado, valida mesmo assim", () => {
      expect(
        phoneIssue({ ...existente, phone: "(11) 99999-9999" })
      ).not.toBeNull();
      expect(phoneIssue({ ...existente, phone: "(47) 99187-8070" })).toBeNull();
    });
  });
});
