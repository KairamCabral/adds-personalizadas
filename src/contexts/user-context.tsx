"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database.types";
import type { User } from "@supabase/supabase-js";

interface UserContextValue {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  refetchProfile: () => Promise<void>;
  /** Atualização otimista (ex.: avatar_url logo após upload) */
  patchProfile: (updates: Partial<Profile>) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (authUser) {
          setUser(authUser);
          await fetchProfile(authUser.id);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
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

  const refetchProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const id = authUser?.id ?? user?.id;
    if (id) await fetchProfile(id);
  }, [user?.id, fetchProfile]);

  const patchProfile = useCallback((updates: Partial<Profile>) => {
    setProfile((p) => (p ? { ...p, ...updates } : null));
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      isLoading,
      error,
      refetchProfile,
      patchProfile,
    }),
    [user, profile, isLoading, error, refetchProfile, patchProfile]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser deve ser usado dentro de UserProvider");
  }
  return ctx;
}
