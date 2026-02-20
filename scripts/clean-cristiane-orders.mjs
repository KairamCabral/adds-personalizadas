#!/usr/bin/env node
/**
 * Remove todos os pedidos da Cristiane Rhoden Campara (incluindo arquivados).
 * Uso: node scripts/clean-cristiane-orders.mjs
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
  const { data: clients, error: errClient } = await supabase
    .from("clients")
    .select("id, name")
    .or("name.ilike.%cristiane%rhoden%,name.ilike.%rhoden%campara%");

  if (errClient) {
    console.error("Erro ao buscar cliente:", errClient);
    process.exit(1);
  }

  if (!clients?.length) {
    console.log("Nenhum cliente encontrado com nome Cristiane Rhoden.");
    return;
  }

  const clientId = clients[0].id;
  console.log(`Cliente: ${clients[0].name} (${clientId})`);

  const { data: deleted, error } = await supabase
    .from("orders")
    .delete()
    .eq("client_id", clientId)
    .select("id, order_number, title, archived_at");

  if (error) {
    console.error("Erro ao deletar:", error);
    process.exit(1);
  }

  console.log(`Removidos ${deleted?.length ?? 0} pedido(s):`);
  (deleted || []).forEach((o) =>
    console.log(`  - #${o.order_number} ${o.title}${o.archived_at ? " (arquivado)" : ""}`)
  );
}

main();
