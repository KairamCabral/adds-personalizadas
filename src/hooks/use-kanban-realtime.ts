"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToKanban } from "@/lib/supabase/realtime";

// Rajadas de eventos (ex.: import em lote do Tiny escrevendo centenas de pedidos
// e etiquetas) chegavam como 1 invalidação por evento — e cada invalidação
// refaz o getOrders() inteiro (todos os pedidos + 9 joins + RPC) em TODOS os
// clientes conectados. Isso esgotava as conexões do banco (pool timeout) e
// derrubava até o import do Tiny. Aqui coalescemos a rajada: no máximo 1 refetch
// a cada ~2,5s, e 800ms após o último evento quando é algo pontual.
const DEBOUNCE_MS = 800;
const MAX_WAIT_MS = 2500;

export function useKanbanRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

    const fire = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (maxWaitTimer) {
        clearTimeout(maxWaitTimer);
        maxWaitTimer = null;
      }
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    };

    const scheduleInvalidate = () => {
      // Debounce: reinicia a janela a cada evento…
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fire, DEBOUNCE_MS);
      // …mas garante no máximo MAX_WAIT_MS de espera numa rajada contínua.
      if (!maxWaitTimer) maxWaitTimer = setTimeout(fire, MAX_WAIT_MS);
    };

    const unsubscribe = subscribeToKanban(() => {
      scheduleInvalidate();
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (maxWaitTimer) clearTimeout(maxWaitTimer);
      unsubscribe();
    };
  }, [queryClient]);
}
