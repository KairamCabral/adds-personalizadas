"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<string, string> = {
  MASTER: "Administrador",
  GESTOR: "Gestor",
  PRESTADOR: "Prestador",
};

const ROLE_COLORS: Record<string, string> = {
  MASTER: "bg-red-500/10 text-red-500 border-red-500/30",
  GESTOR: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  PRESTADOR: "bg-green-500/10 text-green-500 border-green-500/30",
};

interface ProfileHeaderProps {
  profile: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    created_at: string;
  };
  onProfileUpdated?: () => void;
}

export function ProfileHeader({ profile, onProfileUpdated }: ProfileHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const initials = profile.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const memberSince = new Date(profile.created_at).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const filePath = `avatars/${profile.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("adds-crm")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("adds-crm")
        .getPublicUrl(filePath);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      toast.success("Foto atualizada!");
      queryClient.invalidateQueries({ queryKey: ["user"] });
      onProfileUpdated?.();
    } catch (error) {
      toast.error("Erro ao atualizar foto");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-5 p-6 rounded-xl border bg-card">
      <div className="relative group">
        <Avatar className="h-20 w-20 text-lg">
          <AvatarImage src={profile.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
            {initials}
          </AvatarFallback>
        </Avatar>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarUpload}
          className="hidden"
        />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{profile.full_name}</h2>
          <Badge variant="outline" className={ROLE_COLORS[profile.role] ?? ""}>
            {ROLE_LABELS[profile.role] ?? profile.role}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Membro desde {memberSince}
        </p>
      </div>
    </div>
  );
}
