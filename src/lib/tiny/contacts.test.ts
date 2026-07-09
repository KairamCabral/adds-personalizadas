import { describe, it, expect, beforeEach, vi } from "vitest";

// Mocks (hoisted) do cliente Tiny e do throttle
const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("./rate-limiter", () => ({
  enqueueTinyRequest: (fn: () => unknown) => fn(),
}));

vi.mock("@/lib/tiny-api", () => ({
  tinyApiGet: getMock,
  tinyApiPost: postMock,
  TinyTokenExpiredError: class TinyTokenExpiredError extends Error {},
}));

import { createOrFindTinyContact } from "./contacts";

const ALREADY_EXISTS_400 = `Tiny API POST /contatos failed: 400 {"detalhes":[{"campo":"cnpj","mensagem":"Contato com CPF '070.486.659-55' já existe"}]}`;

describe("createOrFindTinyContact", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("encontra pela busca FORMATADA quando os dígitos não casam (sem POST)", async () => {
    getMock
      .mockResolvedValueOnce({ itens: [] }) // cpfCnpj dígitos → vazio
      .mockResolvedValueOnce({ itens: [{ id: 555 }] }); // cpfCnpj formatado → achou

    const res = await createOrFindTinyContact({
      name: "Fulano",
      document: "07048665955",
      sales_channel: null,
    });

    expect(res).toEqual({ tiny_id: 555, found: true });
    expect(postMock).not.toHaveBeenCalled();
  });

  it("recupera do 400 'já existe': refaz a busca e usa o id encontrado (job vira DONE, não FAILED)", async () => {
    getMock
      .mockResolvedValueOnce({ itens: [] }) // pré-busca dígitos
      .mockResolvedValueOnce({ itens: [] }) // pré-busca formatado
      .mockResolvedValueOnce({ itens: [] }) // fallback dígitos
      .mockResolvedValueOnce({ itens: [{ id: 999 }] }); // fallback formatado → achou
    postMock.mockRejectedValueOnce(new Error(ALREADY_EXISTS_400));

    const res = await createOrFindTinyContact({
      name: "Fulano",
      document: "07048665955",
      sales_channel: "DENTISTA",
    });

    expect(res).toEqual({ tiny_id: 999, found: true });
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("cria novo contato quando não existe em lugar nenhum", async () => {
    getMock.mockResolvedValue({ itens: [] }); // todas as buscas vazias
    postMock.mockResolvedValueOnce({ id: 321 });

    const res = await createOrFindTinyContact({
      name: "Novo Contato",
      document: "07048665955",
      sales_channel: null,
    });

    expect(res).toEqual({ tiny_id: 321, found: false });
  });

  it("propaga 'já existe' apenas se a busca de recuperação também falhar", async () => {
    getMock.mockResolvedValue({ itens: [] }); // nunca acha
    postMock.mockRejectedValueOnce(new Error(ALREADY_EXISTS_400));

    await expect(
      createOrFindTinyContact({
        name: "Fulano",
        document: "07048665955",
        sales_channel: null,
      })
    ).rejects.toThrow(/já existe/i);
  });
});
