"use client";

import { useLayoutEffect } from "react";

/** Replica a lógica de `ThemeProvider` para restaurar o tema ao sair da rota. */
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

/**
 * Orçamento público: sempre apresentação em tema claro, independente da preferência do CRM.
 */
export function QuoteLightMode() {
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
