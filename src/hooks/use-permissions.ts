"use client";

import { useUser } from "./use-user";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";

export function usePermissions() {
  const { profile, isLoading } = useUser();
  const role = (profile?.role ?? "PRESTADOR") as UserRole;

  // While loading, report all permissions as allowed so the sidebar
  // doesn't flash "empty" before the real role is resolved.
  function can(permission: Permission): boolean {
    if (isLoading) return true;
    return hasPermission(role, permission);
  }

  function canAny(...permissions: Permission[]): boolean {
    if (isLoading) return true;
    return permissions.some((p) => hasPermission(role, p));
  }

  function canAll(...permissions: Permission[]): boolean {
    if (isLoading) return true;
    return permissions.every((p) => hasPermission(role, p));
  }

  return {
    role,
    isLoading,
    can,
    canAny,
    canAll,
    isMaster: role === "MASTER",
    isGestor: role === "GESTOR",
    isPrestador: role === "PRESTADOR",
  };
}
