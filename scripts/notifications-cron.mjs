// Gerador de SQL idempotente do pg_cron para rotinas de Notificações e Billing
// (billing-lifecycle-cron diário + sunday-digest dominical opt-in).
//
// Uso:
//   npm run notifications:cron
//   -> Copia a saída SQL gerada e executa no SQL Editor do Supabase Dashboard.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "").split(/\s+#/)[0].trim();
    env[match[1]] = value;
  }
  return env;
}

const env = loadEnv(join(root, ".env"));

function resolveFunctionBaseUrl() {
  const candidate = env.SUPABASE_FUNCTION_URL || env.VITE_SUPABASE_URL || "";
  const match = candidate.match(/https:\/\/([a-z0-9]+)/);
  if (!match) {
    console.error(
      "[ERRO] Nao foi possivel extrair o project ref de SUPABASE_FUNCTION_URL/VITE_SUPABASE_URL no .env",
    );
    process.exit(1);
  }
  return `https://${match[1]}.supabase.co/functions/v1`;
}

function main() {
  const baseUrl = resolveFunctionBaseUrl();
  const authToken = env.CRON_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!authToken) {
    console.error("[ERRO] CRON_SECRET e SUPABASE_SERVICE_ROLE_KEY ausentes no .env.");
    process.exit(1);
  }

  const template = readFileSync(
    join(root, "supabase", "notifications-cron.sql"),
    "utf8",
  );
  const rendered = template
    .replaceAll("<FUNCTION_BASE_URL>", baseUrl)
    .replaceAll("<CRON_AUTH_TOKEN>", authToken);

  console.log(rendered);
}

main();
