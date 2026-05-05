import { describe, expect, it } from "vitest";
import { canMoveToAprovadoFromState } from "./can-move-to-aprovado";

describe("canMoveToAprovadoFromState", () => {
  it("permite quando uses_existing_art=true (sem artes)", () => {
    expect(
      canMoveToAprovadoFromState({
        uses_existing_art: true,
        approved_artwork_count: 0,
      })
    ).toEqual({ allowed: true });
  });

  it("permite quando há ao menos 1 arte aprovada (sem override)", () => {
    expect(
      canMoveToAprovadoFromState({
        uses_existing_art: false,
        approved_artwork_count: 1,
      })
    ).toEqual({ allowed: true });
  });

  it("permite quando ambos os caminhos satisfazem", () => {
    expect(
      canMoveToAprovadoFromState({
        uses_existing_art: true,
        approved_artwork_count: 3,
      })
    ).toEqual({ allowed: true });
  });

  it("bloqueia pedido sem arte e sem override (caso do bug #5277)", () => {
    expect(
      canMoveToAprovadoFromState({
        uses_existing_art: false,
        approved_artwork_count: 0,
      })
    ).toEqual({
      allowed: false,
      reason: "no_approved_artwork_and_no_override",
    });
  });

  it("bloqueia mesmo com várias artes pendentes (sem nenhuma aprovada)", () => {
    // approved_artwork_count conta APENAS artworks com status='APROVADA'.
    // Pendentes/ajuste/descartadas não entram.
    expect(
      canMoveToAprovadoFromState({
        uses_existing_art: false,
        approved_artwork_count: 0,
      })
    ).toEqual({
      allowed: false,
      reason: "no_approved_artwork_and_no_override",
    });
  });
});
