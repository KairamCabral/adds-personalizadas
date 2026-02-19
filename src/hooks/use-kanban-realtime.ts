"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToKanban } from "@/lib/supabase/realtime";
import { toast } from "sonner";

export function useKanbanRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribeToKanban((payload) => {
      // Invalidate orders query to refetch
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      // Optional: show toast for changes from other users
      if (payload.eventType === "INSERT") {
        toast.info("Novo pedido adicionado ao pipeline", {
          duration: 3000,
        });
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
