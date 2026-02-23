import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/bling/oauth/callback?code=XXX&state=SUPPLIER_ID
 * Recebe o código de autorização do Bling, troca por access_token e refresh_token
 * e salva no fornecedor correspondente.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // supplier_id
  const oauthError = searchParams.get("error");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    `https://${request.headers.get("host")}`;

  const baseRedirect = `${appUrl}/settings/suppliers`;

  if (oauthError || !code || !state) {
    const msg = oauthError ?? "codigo_ausente";
    return NextResponse.redirect(`${baseRedirect}?bling_error=${encodeURIComponent(msg)}`);
  }

  const supplierId = state;

  try {
    const admin = createAdminClient();

    const { data: supplier, error: supplierError } = await admin
      .from("suppliers")
      .select("id, bling_client_id, bling_client_secret")
      .eq("id", supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.redirect(
        `${baseRedirect}?bling_error=${encodeURIComponent("fornecedor_nao_encontrado")}`
      );
    }

    if (!supplier.bling_client_id || !supplier.bling_client_secret) {
      return NextResponse.redirect(
        `${baseRedirect}?bling_error=${encodeURIComponent("credenciais_ausentes")}`
      );
    }

    const redirectUri = `${appUrl}/api/bling/oauth/callback`;
    const basicAuth = Buffer.from(
      `${supplier.bling_client_id}:${supplier.bling_client_secret}`
    ).toString("base64");

    const tokenRes = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("[Bling OAuth] Falha na troca de tokens:", errorText);
      return NextResponse.redirect(
        `${baseRedirect}?bling_error=${encodeURIComponent("falha_troca_token")}`
      );
    }

    const tokenData = await tokenRes.json();
    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in ?? 21600) * 1000
    ).toISOString();

    await admin
      .from("suppliers")
      .update({
        bling_access_token: tokenData.access_token,
        bling_refresh_token: tokenData.refresh_token ?? null,
        bling_token_expires_at: expiresAt,
      })
      .eq("id", supplierId);

    return NextResponse.redirect(
      `${baseRedirect}?bling_connected=1&supplier_id=${supplierId}`
    );
  } catch (err) {
    console.error("[Bling OAuth] Erro no callback:", err);
    return NextResponse.redirect(
      `${baseRedirect}?bling_error=${encodeURIComponent("erro_interno")}`
    );
  }
}
