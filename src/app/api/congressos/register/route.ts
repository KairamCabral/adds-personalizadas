import { NextRequest, NextResponse, after } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { congressoRegisterSchema } from "@/lib/validations";
import { syncRegistrationNow } from "@/services/congressos-sync.service";

type AdminClient = ReturnType<typeof createAdminClient>;

interface Redemption {
  token: string;
  short_code: string;
}

async function fetchRedemption(
  supabase: AdminClient,
  registrationId: string
): Promise<Redemption | null> {
  const { data } = await supabase
    .from("event_gift_redemptions")
    .select("token, short_code")
    .eq("registration_id", registrationId)
    .maybeSingle();
  return data ?? null;
}

/** Gera short_code de 6 dígitos com retry em colisão (edition_id, short_code). */
async function createRedemption(
  supabase: AdminClient,
  editionId: string,
  registrationId: string
): Promise<Redemption | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const shortCode = String(Math.floor(100000 + Math.random() * 900000));
    const { data, error } = await supabase
      .from("event_gift_redemptions")
      .insert({
        edition_id: editionId,
        registration_id: registrationId,
        short_code: shortCode,
      })
      .select("token, short_code")
      .single();

    if (!error && data) return data;

    // 23505 = unique_violation: colisão de short_code (retry) OU registration_id
    // já tem redemption (retorna a existente).
    if (error && error.code === "23505") {
      const existing = await fetchRedemption(supabase, registrationId);
      if (existing) return existing;
      continue; // colisão de short_code → tenta outro
    }

    console.error("[congressos/register] redemption insert:", error);
    return null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { success: ipOk } = rateLimit(`congress-reg:${ip}`, {
    windowMs: 300000,
    max: 15,
  });
  if (!ipOk) return rateLimitResponse();

  try {
    const body = await request.json().catch(() => null);
    const parsed = congressoRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const digits = input.document.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      return NextResponse.json(
        { error: "CPF/CNPJ inválido." },
        { status: 400 }
      );
    }

    const { success: docOk } = rateLimit(`congress-doc:${digits}`, {
      windowMs: 60000,
      max: 5,
    });
    if (!docOk) return rateLimitResponse();

    const captchaOk = await verifyTurnstile(input.turnstile_token, ip);
    if (!captchaOk) {
      return NextResponse.json(
        { error: "Falha na verificação anti-robô. Tente novamente." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Edição precisa existir e estar ativa
    const { data: edition } = await supabase
      .from("event_editions")
      .select("id, is_active, gift_name")
      .eq("slug", input.slug)
      .maybeSingle();
    if (!edition || !edition.is_active) {
      return NextResponse.json(
        { error: "Pré-cadastro indisponível para este evento." },
        { status: 400 }
      );
    }

    // Dedup: 1 pré-cadastro por (edição, documento) → retorna o mesmo brinde
    const { data: existingReg } = await supabase
      .from("event_registrations")
      .select("id")
      .eq("edition_id", edition.id)
      .eq("document", digits)
      .maybeSingle();
    if (existingReg) {
      const red = await fetchRedemption(supabase, existingReg.id);
      if (red) {
        return NextResponse.json({
          token: red.token,
          short_code: red.short_code,
          gift_name: edition.gift_name,
          participant_first_name: null,
          alreadyRegistered: true,
        });
      }
    }

    // Resolve cliente existente (dedup por dígitos normalizados)
    let matchedClientId: string | null = input.existing_client_id ?? null;
    let isExistingClient = input.is_existing_client ?? false;
    let contactType = input.contact_type ?? null;
    let name = input.name?.trim() || null;
    let email = input.email ?? null;
    let phone = input.phone?.trim() || null;

    const { data: clientRows } = await supabase.rpc("find_client_by_document", {
      doc_digits: digits,
    });
    const client = Array.isArray(clientRows) ? clientRows[0] : null;
    if (client) {
      isExistingClient = true;
      matchedClientId = client.id;
      contactType = contactType ?? client.sales_channel ?? null;
      name = name ?? client.name ?? null;
      email = email ?? client.email ?? null;
      phone = phone ?? client.phone ?? null;
    }

    const qualified =
      contactType === "DENTISTA" || contactType === "DISTRIBUIDORA";

    const ipHash = createHmac(
      "sha256",
      process.env.IP_HASH_SECRET ?? process.env.CRON_SECRET ?? "adds-congresso"
    )
      .update(ip)
      .digest("hex")
      .slice(0, 32);

    const { data: reg, error: regErr } = await supabase
      .from("event_registrations")
      .insert({
        edition_id: edition.id,
        document: digits,
        name,
        email,
        phone,
        contact_type: contactType,
        qualified,
        is_existing_client: isExistingClient,
        matched_client_id: matchedClientId,
        consent_version: input.consent_version,
        consent_at: new Date().toISOString(),
        consent_ip_hmac: ipHash,
        idempotency_key: input.idempotency_key,
        utm_source: input.utm_source ?? null,
        utm_medium: input.utm_medium ?? null,
        utm_campaign: input.utm_campaign ?? null,
        utm_content: input.utm_content ?? null,
      })
      .select("id")
      .single();

    if (regErr || !reg) {
      // Corrida: unique (edition_id, document) ou idempotency_key → retorna existente
      if (regErr?.code === "23505") {
        const { data: raced } = await supabase
          .from("event_registrations")
          .select("id")
          .eq("edition_id", edition.id)
          .eq("document", digits)
          .maybeSingle();
        if (raced) {
          const red = await fetchRedemption(supabase, raced.id);
          if (red) {
            return NextResponse.json({
              token: red.token,
              short_code: red.short_code,
              gift_name: edition.gift_name,
              participant_first_name: null,
              alreadyRegistered: true,
            });
          }
        }
      }
      console.error("[congressos/register] registration insert:", regErr);
      return NextResponse.json(
        { error: "Erro ao registrar o pré-cadastro." },
        { status: 500 }
      );
    }

    const redemption = await createRedemption(supabase, edition.id, reg.id);
    if (!redemption) {
      return NextResponse.json(
        { error: "Erro ao gerar o brinde." },
        { status: 500 }
      );
    }

    // Enfileira (write-then-queue). Falhas aqui não afetam o participante;
    // os workers (Épicos 3/4) drenam depois.
    const { error: jobErr } = await supabase
      .from("tiny_contact_sync_jobs")
      .insert({ registration_id: reg.id, status: "PENDING" });
    if (jobErr) console.error("[congressos/register] sync job enqueue:", jobErr);

    if (email) {
      const { error: dispErr } = await supabase
        .from("event_dispatches")
        .insert({
          registration_id: reg.id,
          channel: "EMAIL",
          status: "PENDENTE",
          recipient: email,
        });
      if (dispErr)
        console.error("[congressos/register] dispatch enqueue:", dispErr);
    }

    // Fast-path: tenta sincronizar com o Tiny logo após responder (near-real-time),
    // sem esperar o cron diário. Best-effort — falha vira retry/backoff na fila.
    const registrationId = reg.id;
    after(async () => {
      try {
        await syncRegistrationNow(registrationId);
      } catch (e) {
        console.error("[congressos/register] after sync:", e);
      }
    });

    const firstName = name ? name.split(" ")[0] : null;
    return NextResponse.json({
      token: redemption.token,
      short_code: redemption.short_code,
      gift_name: edition.gift_name,
      participant_first_name: firstName,
      alreadyRegistered: false,
    });
  } catch (err) {
    console.error("[congressos/register] erro:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar o pré-cadastro." },
      { status: 500 }
    );
  }
}
