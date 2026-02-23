import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/bling/oauth/start?supplier_id=XXX
 * Inicia o fluxo OAuth 2.0 com o Bling.
 * Redireciona o usuário para a página de autorização do Bling.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supplierId = request.nextUrl.searchParams.get("supplier_id");
  if (!supplierId) {
    return NextResponse.json(
      { error: "supplier_id é obrigatório." },
      { status: 400 }
    );
  }

  // Busca o fornecedor usando apenas colunas que sempre existem
  const { data: supplierBase, error: baseError } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("id", supplierId)
    .single();

  if (baseError || !supplierBase) {
    return NextResponse.json(
      { error: "Fornecedor não encontrado.", supplier_id: supplierId },
      { status: 404 }
    );
  }

  // Busca as colunas OAuth (podem não existir se a migration ainda não foi aplicada)
  const { data: oauthFields, error: oauthError } = await supabase
    .from("suppliers")
    .select("bling_client_id")
    .eq("id", supplierId)
    .single();

  if (oauthError) {
    return NextResponse.json(
      {
        error: "Migration pendente.",
        detail: "As colunas OAuth do Bling ainda não foram criadas no banco. Execute a migration SQL no Supabase → SQL Editor.",
        sql: "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bling_client_id TEXT, ADD COLUMN IF NOT EXISTS bling_client_secret TEXT, ADD COLUMN IF NOT EXISTS bling_access_token TEXT, ADD COLUMN IF NOT EXISTS bling_refresh_token TEXT, ADD COLUMN IF NOT EXISTS bling_token_expires_at TIMESTAMPTZ;",
      },
      { status: 500 }
    );
  }

  if (!oauthFields?.bling_client_id) {
    return NextResponse.json(
      { error: "Client ID do Bling não configurado. Edite o fornecedor, preencha o Client ID e salve antes de conectar." },
      { status: 400 }
    );
  }

  const supplier = { ...supplierBase, bling_client_id: oauthFields.bling_client_id };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    `https://${request.headers.get("host")}`;
  const redirectUri = `${appUrl}/api/bling/oauth/callback`;

  const authUrl = new URL("https://www.bling.com.br/Api/v3/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", supplier.bling_client_id);
  authUrl.searchParams.set("state", supplierId);
  authUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(authUrl.toString());
}
