"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToKanban } from "@/lib/supabase/realtime";

export function useKanbanRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribeToKanban((payload) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    });

    return unsubscribe;
  }, [queryClient]);
}
