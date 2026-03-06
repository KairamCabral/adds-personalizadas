"use client";

import { useUser } from "@/hooks/use-user";
import { ProfileHeader } from "./_components/profile-header";
import { ProfileForm } from "./_components/profile-form";
import { PasswordForm } from "./_components/password-form";
import { NotificationPreferences } from "./_components/notification-preferences";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const { profile, isLoading, refetchProfile } = useUser();

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex-1 p-6 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie suas informações pessoais e preferências
        </p>
      </div>

      <ProfileHeader profile={profile} onProfileUpdated={refetchProfile} />

      <Separator />

      <ProfileForm profile={profile} onProfileUpdated={refetchProfile} />

      <Separator />

      <PasswordForm />

      <Separator />

      <NotificationPreferences
        profile={{
          id: profile.id,
          notification_preferences:
            profile.notification_preferences as Record<
              string,
              { in_app?: boolean; email?: boolean }
            > | null,
        }}
        onProfileUpdated={refetchProfile}
      />
    </div>
  );
}
