import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

type ArtworkRow = Database["public"]["Tables"]["artworks"]["Row"];
type ArtworkStatus = ArtworkRow["status"];

export type Artwork = ArtworkRow;

export type ApprovalToken = Database["public"]["Tables"]["approval_tokens"]["Row"];

const BUCKET = "artworks";
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".pdf"];
const DEFAULT_EXPIRES_DAYS = 7;

function validateFile(file: File): void {
  if (file.size > MAX_SIZE) {
    throw new Error("Arquivo muito grande. Máximo 20MB.");
  }
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "bin");
  if (!ALLOWED_EXT.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado. Use JPG, PNG ou PDF.");
  }
}

export async function getArtworksByOrder(orderId: string): Promise<Artwork[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("order_id", orderId)
    .order("version", { ascending: false })
    .order("variation_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Artwork[];
}

/** Agrupa artes por versão (última versão primeiro). Cada versão pode ter múltiplas variações. */
export function groupArtworksByVersion(artworks: Artwork[]): Map<number, Artwork[]> {
  const map = new Map<number, Artwork[]>();
  for (const aw of artworks) {
    const list = map.get(aw.version) ?? [];
    list.push(aw);
    map.set(aw.version, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.variation_index ?? 1) - (b.variation_index ?? 1));
  }
  return map;
}

export async function uploadArtwork(
  orderId: string,
  file: File,
  options?: { notes?: string; asVariation?: boolean }
): Promise<Artwork> {
  validateFile(file);
  const supabase = createClient();
  const { notes, asVariation } = options ?? {};

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: latest } = await supabase
    .from("artworks")
    .select("version, variation_index")
    .eq("order_id", orderId)
    .order("version", { ascending: false })
    .order("variation_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  let version: number;
  let variationIndex: number;

  if (asVariation && latest) {
    version = latest.version;
    variationIndex = (latest.variation_index ?? 1) + 1;
  } else {
    version = (latest?.version ?? 0) + 1;
    variationIndex = 1;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${orderId}/v${version}_${variationIndex}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data: artwork, error: insertError } = await supabase
    .from("artworks")
    .insert({
      order_id: orderId,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      status: "PENDENTE",
      version,
      variation_index: variationIndex,
      adjustment_notes: notes ?? null,
      uploaded_by: user.id,
    } as Database["public"]["Tables"]["artworks"]["Insert"])
    .select()
    .single();

  if (insertError) throw insertError;

  const label = variationIndex > 1 ? `v${version} (opção ${variationIndex})` : `v${version}`;
  await supabase.from("order_history").insert({
    order_id: orderId,
    user_id: user.id,
    action: "artwork_uploaded",
    new_value: `Nova arte ${label} enviada`,
  });

  return artwork as Artwork;
}

export async function deleteArtwork(artworkId: string): Promise<void> {
  const supabase = createClient();
  const { data: artwork } = await supabase
    .from("artworks")
    .select("id, order_id, file_url, status")
    .eq("id", artworkId)
    .single();

  if (!artwork) throw new Error("Arte não encontrada");
  if (artwork.status !== "PENDENTE") {
    throw new Error("Só é possível excluir artes aguardando aprovação.");
  }

  const { data: token } = await supabase
    .from("approval_tokens")
    .select("id")
    .eq("artwork_id", artworkId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (token) {
    throw new Error("Existe um link de aprovação ativo. Revogue-o antes de excluir.");
  }

  const pathMatch = (artwork.file_url as string).match(
    /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/
  );
  if (pathMatch) {
    await supabase.storage.from(BUCKET).remove([pathMatch[1]]);
  }

  const { error } = await supabase.from("artworks").delete().eq("id", artworkId);
  if (error) throw error;
}

export async function generateApprovalLink(
  artworkId: string,
  expiresInDays: number = DEFAULT_EXPIRES_DAYS
): Promise<string> {
  const supabase = createClient();
  const { data: artwork } = await supabase
    .from("artworks")
    .select("id, order_id")
    .eq("id", artworkId)
    .single();

  if (!artwork) throw new Error("Arte não encontrada");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { error } = await supabase.from("approval_tokens").insert({
    order_id: artwork.order_id,
    artwork_id: artworkId,
    token,
    expires_at: expiresAt.toISOString(),
    created_by: user.id,
  } as Database["public"]["Tables"]["approval_tokens"]["Insert"]);

  if (error) throw error;

  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/art/approve/${token}`;
}

export async function getActiveToken(artworkId: string): Promise<ApprovalToken | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("approval_tokens")
    .select("*")
    .eq("artwork_id", artworkId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as ApprovalToken | null;
}
