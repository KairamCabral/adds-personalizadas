import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGREEMENT_CONTENT, AGREEMENT_VERSION } from "@/lib/agreement-template";

const supabase = createClient();

export interface ValidateAgreementResult {
  is_valid: boolean;
  agreement: {
    id: string;
    supplier_id: string;
    token: string;
    token_expires_at: string;
    status: string;
    signed_at: string | null;
    signer_name: string | null;
    signer_role: string | null;
    signer_document: string | null;
    agreement_hash: string | null;
  } | null;
  supplier: {
    id: string;
    name: string;
  } | null;
}

/**
 * Valida o token do termo. Usa admin client para permitir leitura em contexto público.
 */
export async function validateAgreementToken(
  token: string
): Promise<ValidateAgreementResult> {
  const admin = createAdminClient();

  const { data: agreement, error } = await admin
    .from("supplier_agreements")
    .select("*, supplier:suppliers(id, name)")
    .eq("token", token)
    .single();

  if (error || !agreement) {
    return { is_valid: false, agreement: null, supplier: null };
  }

  const supplier = agreement.supplier as { id: string; name: string } | null;
  const isExpired = new Date(agreement.token_expires_at) < new Date();
  const isSigned = agreement.status === "signed";
  const isRevoked = agreement.status === "revoked";

  if (isRevoked) {
    return {
      is_valid: false,
      agreement: {
        id: agreement.id,
        supplier_id: agreement.supplier_id,
        token: agreement.token,
        token_expires_at: agreement.token_expires_at,
        status: agreement.status,
        signed_at: agreement.signed_at,
        signer_name: agreement.signer_name,
        signer_role: agreement.signer_role,
        signer_document: agreement.signer_document,
        agreement_hash: agreement.agreement_hash,
      },
      supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
    };
  }

  if (isSigned) {
    return {
      is_valid: false,
      agreement: {
        id: agreement.id,
        supplier_id: agreement.supplier_id,
        token: agreement.token,
        token_expires_at: agreement.token_expires_at,
        status: agreement.status,
        signed_at: agreement.signed_at,
        signer_name: agreement.signer_name,
        signer_role: agreement.signer_role,
        signer_document: agreement.signer_document,
        agreement_hash: agreement.agreement_hash,
      },
      supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
    };
  }

  if (isExpired) {
    return {
      is_valid: false,
      agreement: {
        id: agreement.id,
        supplier_id: agreement.supplier_id,
        token: agreement.token,
        token_expires_at: agreement.token_expires_at,
        status: "expired",
        signed_at: agreement.signed_at,
        signer_name: agreement.signer_name,
        signer_role: agreement.signer_role,
        signer_document: agreement.signer_document,
        agreement_hash: agreement.agreement_hash,
      },
      supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
    };
  }

  return {
    is_valid: true,
    agreement: {
      id: agreement.id,
      supplier_id: agreement.supplier_id,
      token: agreement.token,
      token_expires_at: agreement.token_expires_at,
      status: agreement.status,
      signed_at: agreement.signed_at,
      signer_name: agreement.signer_name,
      signer_role: agreement.signer_role,
      signer_document: agreement.signer_document,
      agreement_hash: agreement.agreement_hash,
    },
    supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
  };
}

export async function generateAgreementToken(
  supplierId: string,
  expiresInDays = 7
) {
  const { data: authData } = await supabase.auth.getUser();
  const createdBy = authData.user?.id ?? null;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data, error } = await supabase
    .from("supplier_agreements")
    .insert({
      supplier_id: supplierId,
      token_expires_at: expiresAt.toISOString(),
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export interface SignAgreementData {
  name: string;
  role: string;
  document: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Registra a assinatura do termo. Usa admin client para contexto público.
 */
export async function signAgreement(token: string, data: SignAgreementData) {
  const admin = createAdminClient();

  const validation = await validateAgreementToken(token);
  if (!validation.is_valid || !validation.agreement) {
    throw new Error("Token inválido, expirado ou termo já assinado.");
  }

  const agreementHash = await hashAgreementContent(AGREEMENT_CONTENT);

  const signedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from("supplier_agreements")
    .update({
      signed_at: signedAt,
      signer_name: data.name,
      signer_role: data.role,
      signer_document: data.document,
      signer_ip: data.ip ?? null,
      signer_user_agent: data.userAgent ?? null,
      agreement_hash: agreementHash,
      status: "signed",
    })
    .eq("id", validation.agreement.id);

  if (updateError) throw updateError;

  await admin
    .from("suppliers")
    .update({
      is_active: true,
      activated_at: signedAt,
      deactivated_at: null,
      deactivation_reason: null,
    })
    .eq("id", validation.agreement.supplier_id);

  return {
    ...validation.agreement,
    signed_at: signedAt,
    agreement_hash: agreementHash,
  };
}

async function hashAgreementContent(content: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(content).digest("hex");
}

export async function revokeAgreement(agreementId: string, reason: string) {
  const { data: authData } = await supabase.auth.getUser();
  const revokedBy = authData.user?.id ?? null;

  const { data: agreement, error: fetchError } = await supabase
    .from("supplier_agreements")
    .select("supplier_id")
    .eq("id", agreementId)
    .single();

  if (fetchError || !agreement) throw new Error("Termo não encontrado.");

  const { error: updateError } = await supabase
    .from("supplier_agreements")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
      revocation_reason: reason,
    })
    .eq("id", agreementId);

  if (updateError) throw updateError;

  await supabase
    .from("suppliers")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivation_reason: `Termo revogado: ${reason}`,
    })
    .eq("id", agreement.supplier_id);

  return { success: true };
}

export async function getActiveAgreement(
  supplierId: string,
  supabaseClient?: SupabaseClient<Database>
) {
  const db = supabaseClient ?? supabase;
  const { data, error } = await db
    .from("supplier_agreements")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("status", "signed")
    .order("signed_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function hasValidAgreement(
  supplierId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<boolean> {
  const agreement = await getActiveAgreement(supplierId, supabaseClient);
  return !!agreement;
}
