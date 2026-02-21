#!/usr/bin/env node
/**
 * Remove todos os orçamentos públicos e os cards (orders) do tipo ORCAMENTO_PUBLICO.
 * Uso: node scripts/cleanup-public-quotes.mjs
 * Requer: .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (e) {
    console.error("Erro ao carregar .env.local:", e.message);
    process.exit(1);
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  // 1. Desvincula public_quotes do order_id
  const { data: updated, error: updErr } = await supabase
    .from("public_quotes")
    .update({ order_id: null })
    .not("order_id", "is", null)
    .select("id");

  if (updErr) {
    console.error("Erro ao desvincular public_quotes:", updErr);
    process.exit(1);
  }
  console.log(`Desvinculados: ${updated?.length ?? 0} orçamento(s)`);

  // 2. Deleta orders do tipo ORCAMENTO_PUBLICO
  const { data: deletedOrders, error: delOrdErr } = await supabase
    .from("orders")
    .delete()
    .eq("order_type", "ORCAMENTO_PUBLICO")
    .select("id, order_number, title");

  if (delOrdErr) {
    console.error("Erro ao deletar orders:", delOrdErr);
    process.exit(1);
  }
  console.log(`Removidos ${deletedOrders?.length ?? 0} card(s)/pedido(s):`);
  (deletedOrders || []).forEach((o) => console.log(`  - #${o.order_number} ${o.title}`));

  // 3. Deleta todos os public_quotes
  const { data: deletedQuotes, error: delQuoteErr } = await supabase
    .from("public_quotes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id, client_name");

  if (delQuoteErr) {
    console.error("Erro ao deletar public_quotes:", delQuoteErr);
    process.exit(1);
  }
  console.log(`Removidos ${deletedQuotes?.length ?? 0} orçamento(s) público(s):`);
  (deletedQuotes || []).forEach((q) => console.log(`  - ${q.client_name}`));

  console.log("\nLimpeza concluída.");
}

main();
