/**
 * Sincronização Tiny → CRM (uso em API routes / servidor).
 * Mantido separado de clients.service para não importar tiny-api no bundle do cliente.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Client } from "@/types/database.types";
import { tinyApiGet } from "@/lib/tiny-api";
import { mapContactToClient } from "@/lib/tiny-sync-incremental";

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Re-sincroniza um cliente do CRM com os dados atuais do Tiny.
 * Útil quando cliente foi importado sem endereço (ex: contato antigo do Tiny).
 */
export async function syncClientFromTiny(clientId: string): Promise<{
  success: boolean;
  client?: Client;
  error?: string;
  fieldsUpdated?: string[];
}> {
  try {
    const supabase = getServiceClient();

    const { data: existing, error: fetchError } = await supabase
      .from("clients")
      .select("id, tiny_id, name, street, city, zip_code")
      .eq("id", clientId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Cliente não encontrado no CRM" };
    }

    if (!existing.tiny_id) {
      return {
        success: false,
        error: "Cliente não tem tiny_id — não foi importado do Tiny",
      };
    }

    let tinyResponse: unknown;
    try {
      tinyResponse = await tinyApiGet(`/contatos/${existing.tiny_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Erro ao buscar no Tiny: ${msg}`,
      };
    }

    const raw =
      (tinyResponse as { data?: unknown })?.data ?? tinyResponse;

    if (!raw || typeof raw !== "object") {
      return {
        success: false,
        error: "Resposta inválida do Tiny",
      };
    }

    const mapped = mapContactToClient(raw);

    const fieldsUpdated: string[] = [];
    if (mapped.street && mapped.street !== existing.street) fieldsUpdated.push("street");
    if (mapped.city && mapped.city !== existing.city) fieldsUpdated.push("city");
    if (mapped.zip_code && mapped.zip_code !== existing.zip_code) fieldsUpdated.push("zip_code");

    const { data: updated, error: updateError } = await supabase
      .from("clients")
      .update({
        name: mapped.name,
        email: mapped.email,
        phone: mapped.phone,
        company: mapped.company,
        document: mapped.document,
        person_type: mapped.person_type,
        city: mapped.city,
        state: mapped.state,
        zip_code: mapped.zip_code,
        street: mapped.street,
        number: mapped.number,
        complement: mapped.complement,
        neighborhood: mapped.neighborhood,
        tiny_synced_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .select()
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      client: updated as Client,
      fieldsUpdated,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Re-sincroniza vários clientes em batch.
 * Throttle de 350ms entre requests.
 */
export async function syncClientsFromTinyBatch(
  clientIds: string[],
  onProgress?: (done: number, total: number, current?: string) => void
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}> {
  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ clientId: string; error: string }> = [];

  for (let i = 0; i < clientIds.length; i++) {
    const id = clientIds[i];
    onProgress?.(i, clientIds.length, id);

    try {
      const result = await syncClientFromTiny(id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        errors.push({ clientId: id, error: result.error ?? "unknown" });
      }
    } catch (err) {
      failed++;
      errors.push({
        clientId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (i < clientIds.length - 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  onProgress?.(clientIds.length, clientIds.length);

  return {
    total: clientIds.length,
    succeeded,
    failed,
    errors,
  };
}
