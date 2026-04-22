import { NextRequest, NextResponse } from "next/server";
import { signAgreement } from "@/services/agreements.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, role, document, userAgent } = body;

    if (!token || !name || !role || !document) {
      return NextResponse.json(
        { error: "Dados incompletos: token, name, role e document são obrigatórios." },
        { status: 400 }
      );
    }

    const ipFromHeader =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const agreement = await signAgreement(token, {
      name: String(name).trim(),
      role: String(role).trim(),
      document: String(document).replace(/\D/g, ""),
      ip: ipFromHeader,
      userAgent: userAgent ?? request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      signed_at: agreement?.signed_at ?? new Date().toISOString(),
      agreement_hash: agreement?.agreement_hash ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao assinar termo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
