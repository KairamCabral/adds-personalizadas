import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const BUCKET = "quote-logos";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/svg+xml",
  "application/pdf",
  "application/postscript",
  "application/illustrator",
];
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".pdf", ".cdr", ".ai", ".eps", ".svg"];

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const orderId = formData.get("order_id") as string | null;

    if (!orderId) {
      return NextResponse.json(
        { error: "order_id é obrigatório" },
        { status: 400 }
      );
    }

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 10MB." },
        { status: 400 }
      );
    }

    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "bin");
    const typeOk = file.type ? ALLOWED_TYPES.includes(file.type) : false;
    const extOk = ALLOWED_EXT.includes(ext);
    if (!extOk && !typeOk) {
      return NextResponse.json(
        { error: "Formato não suportado. Use JPG, PNG, PDF ou vetor (CDR, AI, EPS, SVG)." },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const path = `logos/${orderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Erro ao fazer upload" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(uploadData.path);

    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { createClient: createBrowserClient } = await import(
          "@/lib/supabase/client"
        );
        const client = createBrowserClient();
        const { data: { user } } = await client.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        // ignore
      }
    }

    const { error: attachError } = await supabase.from("attachments").insert({
      order_id: orderId,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: userId,
    });

    if (attachError) {
      console.error("Attachment insert error:", attachError);
      return NextResponse.json(
        { error: "Erro ao registrar anexo" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      path: uploadData.path,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  }
}
