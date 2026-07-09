"use client";

import { useLayoutEffect } from "react";

/** Restaura o tema salvo ao sair da rota (mesmo padrão do fluxo de orçamento). */
function resolveStoredTheme(): "light" | "dark" {
  const stored = localStorage.getItem("adds-theme") as
    | "light"
    | "dark"
    | "system"
    | null;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (!stored || stored === "system") {
    return prefersDark ? "dark" : "light";
  }
  return stored;
}

/** Captura pública de congresso: sempre em tema claro (luz de pavilhão, screenshot). */
export function CongressoLightMode() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");

    return () => {
      const resolved = resolveStoredTheme();
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
    };
  }, []);

  return null;
}
