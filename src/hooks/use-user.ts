"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database.types";
import type { User } from "@supabase/supabase-js";

interface UseUserReturn {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
.eq("id", userId as any)
      .single();

    if (profileError) throw profileError;
    setProfile(data as unknown as typeof profile);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (user) {
          setUser(user);
          await fetchProfile(user.id);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Fire-and-forget: evitar await dentro do callback para não causar deadlock
        // Só setar isLoading=false quando o profile estiver carregado
        fetchProfile(currentUser.id)
          .catch(() => {})
          .finally(() => setIsLoading(false));
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return { user, profile, isLoading, error };
}
