import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * "Já tenho cadastro?" do congresso, lado servidor. O Tiny é simulado; o
 * mapeamento de campos (`mapContactToClient`) é o REAL, para o teste falhar se
 * os nomes de campo do Tiny (cpfCnpj, celular, telefone…) mudarem de sentido.
 */
const { tinyApiGet, findTinyContactIdByDocument } = vi.hoisted(() => ({
  tinyApiGet: vi.fn(),
  findTinyContactIdByDocument: vi.fn(),
}));

vi.mock("@/lib/tiny-api", () => ({ tinyApiGet }));
vi.mock("@/lib/tiny/rate-limiter", () => ({
  enqueueTinyRequest: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/tiny/contacts", () => ({ findTinyContactIdByDocument }));

import {
  findParticipantByCpf,
  resolveConfirmedTinyParticipant,
  toPublicLookup,
} from "./participant-lookup.server";

const CPF_MAYSA = "14085956990";

/** Contato como o Tiny devolve: `telefone` fixo, `celular` é o WhatsApp. */
const contatoTiny = {
  id: 15158,
  nome: "Maysa Pereira Da Rosa",
  cpfCnpj: "140.859.569-90",
  email: "maysa.pereira.rosa@gmail.com",
  telefone: "(48) 3333-4444",
  celular: "48998546431",
};

function adminSemCliente() {
  return {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  } as never;
}

beforeEach(() => {
  tinyApiGet.mockReset();
  findTinyContactIdByDocument.mockReset();
});

describe("findParticipantByCpf", () => {
  it("achou no CRM → não consulta o Tiny", async () => {
    const admin = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: "c-1",
            name: "Júnior Cesar Alves Cabral",
            email: "junior@gmail.com",
            phone: "(48) 99916-8070",
            document: "52998224725",
            sales_channel: "DENTISTA",
          },
        ],
        error: null,
      }),
    } as never;

    const p = await findParticipantByCpf(admin, "52998224725");

    expect(p?.source).toBe("crm");
    expect(p?.ref).toBe("c-1");
    expect(p?.mobile).toBe("48999168070");
    expect(findTinyContactIdByDocument).not.toHaveBeenCalled();
  });

  it("só no Tiny → acha, e fica com o CELULAR, não com o fixo", async () => {
    findTinyContactIdByDocument.mockResolvedValue(15158);
    tinyApiGet.mockResolvedValue({ data: contatoTiny });

    const p = await findParticipantByCpf(adminSemCliente(), CPF_MAYSA);

    expect(p).toMatchObject({
      source: "tiny",
      ref: "15158",
      clientId: null,
      name: "Maysa Pereira Da Rosa",
      mobile: "48998546431",
    });
  });

  it("contato do Tiny com OUTRO CPF é descartado", async () => {
    findTinyContactIdByDocument.mockResolvedValue(15158);
    tinyApiGet.mockResolvedValue({
      data: { ...contatoTiny, cpfCnpj: "529.982.247-25" },
    });

    expect(await findParticipantByCpf(adminSemCliente(), CPF_MAYSA)).toBeNull();
  });

  it("Tiny com erro → null (falha aberta: segue para o cadastro manual)", async () => {
    findTinyContactIdByDocument.mockResolvedValue(15158);
    tinyApiGet.mockRejectedValue(new Error("Tiny 503"));

    expect(await findParticipantByCpf(adminSemCliente(), CPF_MAYSA)).toBeNull();
  });

  it("Tiny lento → desiste no tempo limite e devolve null", async () => {
    findTinyContactIdByDocument.mockReturnValue(new Promise(() => {}));

    const inicio = Date.now();
    const p = await findParticipantByCpf(adminSemCliente(), CPF_MAYSA, 30);

    expect(p).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});

describe("resolveConfirmedTinyParticipant — revalidação no cadastro", () => {
  it("aceita quando o CPF do contato é o digitado", async () => {
    tinyApiGet.mockResolvedValue({ data: contatoTiny });
    const p = await resolveConfirmedTinyParticipant("15158", CPF_MAYSA);
    expect(p?.name).toBe("Maysa Pereira Da Rosa");
  });

  it("recusa id de contato de OUTRA pessoa (herdaria os dados dela)", async () => {
    tinyApiGet.mockResolvedValue({ data: contatoTiny });
    expect(
      await resolveConfirmedTinyParticipant("15158", "52998224725")
    ).toBeNull();
  });

  it("recusa ref que não é id numérico, sem nem chamar o Tiny", async () => {
    expect(
      await resolveConfirmedTinyParticipant("../contatos", CPF_MAYSA)
    ).toBeNull();
    expect(tinyApiGet).not.toHaveBeenCalled();
  });
});

describe("toPublicLookup — o que sai na rota pública", () => {
  it("nunca contém e-mail ou telefone crus", async () => {
    findTinyContactIdByDocument.mockResolvedValue(15158);
    tinyApiGet.mockResolvedValue({ data: contatoTiny });
    const p = await findParticipantByCpf(adminSemCliente(), CPF_MAYSA);

    const publico = toPublicLookup(p);
    const json = JSON.stringify(publico);

    expect(json).not.toContain("maysa.pereira.rosa@gmail.com");
    expect(json).not.toContain("48998546431");
    expect(json).not.toContain("3333-4444");
    expect(publico).toMatchObject({
      found: true,
      maskedPhone: "(48) •••••-6431",
      phoneValid: true,
    });
  });

  it("sem cadastro → só { found: false }", () => {
    expect(toPublicLookup(null)).toEqual({ found: false });
  });
});
