import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "adds-crm";
const MAX_SIZE = 2 * 1024 * 1024;

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const ALLOWED_MIMES = new Set(Object.values(EXT_TO_MIME));

function resolveContentType(file: File, safeExt: string): string {
  const fromBrowser = (file.type || "").trim().toLowerCase();
  if (fromBrowser && ALLOWED_MIMES.has(fromBrowser)) return fromBrowser;
  return EXT_TO_MIME[safeExt] ?? "image/jpeg";
}

/**
 * Upload de avatar no Storage + atualização de profiles.avatar_url.
 * Usa Buffer: upload com File/Blob no runtime Node do Next costuma falhar no @supabase/supabase-js.
 */
export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY ausente no .env — necessária para upload no Storage.",
      },
      { status: 500 }
    );
  }

  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Imagem muito grande. Máximo 2MB." },
        { status: 400 }
      );
    }

    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = rawExt in EXT_TO_MIME ? rawExt : "jpg";
    const contentType = resolveContentType(file, safeExt);

    if (!ALLOWED_MIMES.has(contentType)) {
      return NextResponse.json(
        { error: "Use JPEG, PNG ou WebP." },
        { status: 400 }
      );
    }

    /**
     * Caminho canônico (igual às policies RLS: avatars/{uid}/avatar.ext).
     * Arquivos antigos em {uid}/avatar.ext (sem pasta "avatars/") faziam o banco apontar
     * para .../avatars/uid/... enquanto o ficheiro estava em .../uid/... → 404 e Avatar só mostrava iniciais.
     */
    const filePath = `avatars/${user.id}/avatar.${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const admin = createAdminClient();

    const { data: uploadData, error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        upsert: true,
        contentType,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[profile/avatar] storage upload:", uploadError);
      return NextResponse.json(
        {
          error:
            uploadError.message ||
            `Falha no Storage. Crie o bucket «${BUCKET}» no Supabase (Storage) e marque como público.`,
        },
        { status: 500 }
      );
    }

    // Só após upload OK: remove cópia legada em {userId}/avatar.* (caminho errado, sem pasta "avatars/")
    try {
      const { data: rootFiles } = await admin.storage.from(BUCKET).list(user.id);
      const legacyPaths = (rootFiles ?? [])
        .filter((f) => /^avatar\.(jpe?g|png|webp)$/i.test(f.name))
        .map((f) => `${user.id}/${f.name}`);
      if (legacyPaths.length > 0) {
        await admin.storage.from(BUCKET).remove(legacyPaths);
      }
    } catch (e) {
      console.warn("[profile/avatar] limpeza legado:", e);
    }

    const pathForUrl = uploadData?.path ?? filePath;
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(pathForUrl);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await admin
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      console.error("[profile/avatar] profiles update:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Erro ao salvar URL da foto." },
        { status: 500 }
      );
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (e) {
    console.error("[profile/avatar]", e);
    const msg = e instanceof Error ? e.message : "Erro interno.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
