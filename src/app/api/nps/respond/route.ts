import { createHmac } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { NPS_THEMES, type NpsTheme } from "@/lib/nps/scoring";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { submitNpsResponse } from "@/services/nps.service";

export const dynamic = "force-dynamic";

const VALID_THEMES = new Set<string>(NPS_THEMES);

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const limiter = rateLimit(`nps-respond:${ip}`, { windowMs: 60_000, max: 10 });
  if (!limiter.success) return rateLimitResponse();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const token = body.token;
  const score = body.score;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 });
  }
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 10) {
    return NextResponse.json({ error: "Nota inválida (use 0 a 10)" }, { status: 400 });
  }

  // limite por token (independe do IP — evita brute-force de um mesmo token)
  const tokenLimiter = rateLimit(`nps-token:${token}`, { windowMs: 60_000, max: 5 });
  if (!tokenLimiter.success) return rateLimitResponse();

  const themes = Array.isArray(body.themes)
    ? (body.themes.filter((t): t is NpsTheme => typeof t === "string" && VALID_THEMES.has(t)) as NpsTheme[])
    : null;

  const ua = request.headers.get("user-agent") ?? "unknown";
  // HMAC (não hash puro) p/ não permitir reverter o IP por dicionário/rainbow (LGPD)
  const ipSecret = process.env.IP_HASH_SECRET ?? process.env.CRON_SECRET ?? "adds-nps";
  const ipHash = createHmac("sha256", ipSecret).update(ip).digest("hex").slice(0, 32);

  const result = await submitNpsResponse({
    token,
    score,
    comment: typeof body.comment === "string" ? body.comment.slice(0, 2000) : null,
    themes: themes && themes.length ? themes : null,
    allowContact: body.allow_contact !== false,
    allowTestimonial: body.allow_testimonial === true,
    meta: { ip_hash: ipHash, ua, via: "web" },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    category: result.category,
    message: result.message,
  });
}
