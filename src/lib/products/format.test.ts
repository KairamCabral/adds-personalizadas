import { describe, expect, it } from "vitest";
import { formatProductWithColor } from "./format";

describe("formatProductWithColor", () => {
  it("combina nome + cor com en-dash quando há color_name", () => {
    expect(
      formatProductWithColor({ product_name: "ADDS Implant", color_name: "Lilás" })
    ).toBe("ADDS Implant – Lilás");
  });

  it("retorna só product_name quando color_name é null", () => {
    expect(
      formatProductWithColor({ product_name: "ADDS Implant", color_name: null })
    ).toBe("ADDS Implant");
  });

  it("retorna só product_name quando color_name é undefined", () => {
    expect(formatProductWithColor({ product_name: "ADDS Ultra" })).toBe("ADDS Ultra");
  });

  it("retorna só product_name quando color_name é string vazia ou whitespace", () => {
    expect(
      formatProductWithColor({ product_name: "ADDS Implant", color_name: "" })
    ).toBe("ADDS Implant");
    expect(
      formatProductWithColor({ product_name: "ADDS Implant", color_name: "  " })
    ).toBe("ADDS Implant");
  });

  it("trima o color_name antes de concatenar", () => {
    expect(
      formatProductWithColor({ product_name: "ADDS Implant", color_name: "  Verde  " })
    ).toBe("ADDS Implant – Verde");
  });
});
