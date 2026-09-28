"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLabelTypes, type LabelTypeRow } from "@/services/labels.service";
import { LABELS } from "@/lib/constants";

// Fallback/seed (evita flash antes do fetch e mantém as etiquetas conhecidas
// renderizando mesmo offline). Espelha src/lib/constants.ts LABELS.
const FALLBACK: LabelTypeRow[] = LABELS.map((l, i) => ({
  slug: l.key,
  name: l.label,
  color: l.color,
  text_color: "#ffffff",
  sort_order: i,
  is_active: true,
  is_system: true,
  created_by: null,
  created_at: "",
  updated_at: "",
}));

export function useLabelTypes() {
  return useQuery({
    queryKey: ["order_label_types"],
    queryFn: getLabelTypes,
    staleTime: 5 * 60 * 1000,
    // Mostra o fallback instantâneo, mas busca o banco já no mount (sem o
    // updatedAt=0 o React Query trataria o seed como fresco e não buscaria).
    initialData: FALLBACK,
    initialDataUpdatedAt: 0,
  });
}

/** Só as etiquetas ativas, ordenadas — para pickers e filtros. */
export function useActiveLabelTypes(): LabelTypeRow[] {
  const { data } = useLabelTypes();
  return useMemo(
    () => (data ?? []).filter((l) => l.is_active),
    [data]
  );
}

/** Map slug -> config (inclui inativas, para renderizar etiquetas já aplicadas). */
export function useLabelTypeMap(): Map<string, LabelTypeRow> {
  const { data } = useLabelTypes();
  return useMemo(() => {
    const m = new Map<string, LabelTypeRow>();
    for (const l of data ?? []) m.set(l.slug, l);
    return m;
  }, [data]);
}
