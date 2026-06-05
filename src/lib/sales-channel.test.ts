import { describe, it, expect } from "vitest";
import {
  channelFromSegment,
  salesChannelFromTinyContact,
  salesChannelFromMarcadores,
  applyChannelMarcador,
  applySalesChannelToTinyContact,
  salesChannelMarcadorName,
} from "./sales-channel";

describe("channelFromSegment", () => {
  it("mapeia dentista/clínica → DENTISTA", () => {
    expect(channelFromSegment("Dentista")).toBe("DENTISTA");
    expect(channelFromSegment("clinica odontológica")).toBe("DENTISTA");
    expect(channelFromSegment("Clínica")).toBe("DENTISTA");
  });

  it("mapeia distribuidora e varejista", () => {
    expect(channelFromSegment("Distribuidora")).toBe("DISTRIBUIDORA");
    expect(channelFromSegment("varejista")).toBe("VAREJISTA");
  });

  it("qualquer outro / vazio → CONSUMIDOR", () => {
    expect(channelFromSegment("outro")).toBe("CONSUMIDOR");
    expect(channelFromSegment("")).toBe("CONSUMIDOR");
    expect(channelFromSegment(null)).toBe("CONSUMIDOR");
    expect(channelFromSegment(undefined)).toBe("CONSUMIDOR");
  });
});

describe("salesChannelFromTinyContact (tipo de contato)", () => {
  it("lê tipo específico de array de objetos {descricao}", () => {
    expect(
      salesChannelFromTinyContact({ tipos: [{ descricao: "dentista" }] })
    ).toBe("DENTISTA");
    expect(
      salesChannelFromTinyContact({
        tipos: [{ descricao: "distribuidora / dental" }],
      })
    ).toBe("DISTRIBUIDORA");
    expect(
      salesChannelFromTinyContact({ tiposContato: ["varejista"] })
    ).toBe("VAREJISTA");
  });

  it("'cliente' (genérico) → CONSUMIDOR", () => {
    expect(salesChannelFromTinyContact({ tipos: ["cliente"] })).toBe(
      "CONSUMIDOR"
    );
  });

  it("específico vence o genérico quando ambos presentes", () => {
    expect(
      salesChannelFromTinyContact({ tipos: ["cliente", "dentista"] })
    ).toBe("DENTISTA");
  });

  it("tipos não-comerciais → null (não chuta)", () => {
    expect(salesChannelFromTinyContact({ tipos: ["fornecedor"] })).toBeNull();
    expect(
      salesChannelFromTinyContact({ tipos: ["transportador", "representante"] })
    ).toBeNull();
    expect(salesChannelFromTinyContact({ tipos: ["outro"] })).toBeNull();
    expect(salesChannelFromTinyContact({})).toBeNull();
  });

  it("marcador canal:<X> tem prioridade (round-trip)", () => {
    expect(
      salesChannelFromTinyContact({
        marcadores: [{ marcador: { nome: "canal:VAREJISTA" } }],
        tipos: ["cliente"],
      })
    ).toBe("VAREJISTA");
  });
});

describe("salesChannelFromMarcadores", () => {
  it("lê string, objeto e marcador aninhado, case-insensitive", () => {
    expect(salesChannelFromMarcadores({ marcadores: ["canal:DENTISTA"] })).toBe(
      "DENTISTA"
    );
    expect(
      salesChannelFromMarcadores({ marcadores: [{ nome: "Canal:dentista" }] })
    ).toBe("DENTISTA");
    expect(
      salesChannelFromMarcadores({
        marcadores: [{ marcador: { descricao: "canal:CONSUMIDOR" } }],
      })
    ).toBe("CONSUMIDOR");
  });

  it("ignora marcadores não-canal e valores inválidos", () => {
    expect(
      salesChannelFromMarcadores({ marcadores: ["personalizadas", "canal:XPTO"] })
    ).toBeNull();
    expect(salesChannelFromMarcadores({})).toBeNull();
  });
});

describe("applyChannelMarcador (escrita aditiva)", () => {
  it("não altera o payload quando canal é null", () => {
    const p = { nome: "X" };
    expect(applyChannelMarcador(p, null)).toBe(p);
  });

  it("anexa sem apagar marcadores existentes", () => {
    const out = applyChannelMarcador(
      { marcadores: [{ marcador: { nome: "personalizadas" } }] },
      "DENTISTA"
    );
    expect(out.marcadores).toHaveLength(2);
    expect(salesChannelFromMarcadores(out)).toBe("DENTISTA");
  });

  it("não duplica o marcador de canal", () => {
    const once = applyChannelMarcador({}, "VAREJISTA");
    const twice = applyChannelMarcador(once, "VAREJISTA");
    expect((twice.marcadores as unknown[]).length).toBe(1);
  });
});

describe("applySalesChannelToTinyContact", () => {
  it("anexa marcador + tipo de contato correspondente", () => {
    const out = applySalesChannelToTinyContact({}, "DISTRIBUIDORA");
    expect(salesChannelFromMarcadores(out)).toBe("DISTRIBUIDORA");
    expect(out.tipos).toEqual([{ descricao: "distribuidora / dental" }]);
  });

  it("round-trip via tipo de contato", () => {
    const out = applySalesChannelToTinyContact({}, "DENTISTA");
    expect(salesChannelFromTinyContact(out)).toBe("DENTISTA");
  });
});

describe("salesChannelMarcadorName", () => {
  it("formata canal:<X>", () => {
    expect(salesChannelMarcadorName("CONSUMIDOR")).toBe("canal:CONSUMIDOR");
  });
});
