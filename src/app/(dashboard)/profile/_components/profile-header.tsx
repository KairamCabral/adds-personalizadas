"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
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
  onProfileUpdated?: () => void | Promise<void>;
}

export function ProfileHeader({ profile, onProfileUpdated }: ProfileHeaderProps) {
  const { patchProfile } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const loadErrorForUrl = useRef<string | null>(null);

  const handleAvatarImageError = useCallback(() => {
    const url = profile.avatar_url ?? "";
    if (!url || loadErrorForUrl.current === url) return;
    loadErrorForUrl.current = url;
    toast.error(
      "A foto não carregou. No Supabase → Storage → bucket «adds-crm»: ative «Public bucket» e a política de leitura pública nos arquivos.",
      { duration: 8000 }
    );
  }, [profile.avatar_url]);

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
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        avatar_url?: string;
      };

      if (!res.ok) {
        throw new Error(json.error ?? "Erro ao enviar a foto");
      }

      if (json.avatar_url) {
        patchProfile({ avatar_url: json.avatar_url });
      }

      toast.success("Foto atualizada!");
      // Não chamar refetch aqui: o refetch imediato pode voltar antes do commit e sobrescrever
      // avatar_url no contexto com null — o Avatar volta a mostrar só as iniciais ("AA").
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao atualizar foto";
      toast.error(msg);
      console.error(error);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-5 p-6 rounded-xl border bg-card">
      <div className="relative group">
        <Avatar className="h-20 w-20 text-lg">
          <AvatarImage
            key={profile.avatar_url ?? "no-avatar"}
            src={profile.avatar_url || undefined}
            className="object-cover"
            alt=""
            referrerPolicy="no-referrer"
            onError={handleAvatarImageError}
          />
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
