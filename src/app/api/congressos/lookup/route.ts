import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getEditionBySlug } from "@/lib/congressos/edition.server";
import {
  findParticipantByCpf,
  toPublicLookup,
} from "@/lib/congressos/participant-lookup.server";
import { isValidCPF } from "@/lib/utils";

export const maxDuration = 15;

/**
 * "Já tenho cadastro?" do wizard público do congresso: procura o CPF no CRM e,
 * se não achar, no Tiny.
 *
 * Pública — por isso:
 *  - devolve só dados mascarados (`toPublicLookup`), nunca e-mail/telefone crus;
 *  - exige edição ATIVA: ninguém dispara chamadas ao Tiny com slug inventado;
 *  - rate limit por IP e por CPF (a consulta ao Tiny custa cota da API).
 *
 * Substitui, só no congresso, o `/api/clients/find-by-document` — que segue
 * servindo o `/quote` e devolve o registro inteiro do cliente.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const { success: ipOk } = rateLimit(`congress-lookup:${ip}`, {
    windowMs: 60000,
    max: 15,
  });
  if (!ipOk) return rateLimitResponse();

  const slug = request.nextUrl.searchParams.get("slug")?.trim() ?? "";
  const digits = (request.nextUrl.searchParams.get("document") ?? "").replace(
    /\D/g,
    ""
  );
  if (!slug || digits.length !== 11 || !isValidCPF(digits)) {
    return NextResponse.json({ found: false });
  }

  const { success: docOk } = rateLimit(`congress-lookup-doc:${digits}`, {
    windowMs: 60000,
    max: 5,
  });
  if (!docOk) return rateLimitResponse();

  const edition = await getEditionBySlug(slug);
  if (!edition?.is_active) return NextResponse.json({ found: false });

  try {
    const participant = await findParticipantByCpf(createAdminClient(), digits);
    return NextResponse.json(toPublicLookup(participant));
  } catch (err) {
    // Falha aberta: o wizard segue para o cadastro manual.
    console.error(
      "[congressos/lookup]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({ found: false });
  }
}
