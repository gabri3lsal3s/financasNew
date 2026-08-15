// Deploy + cron da edge function de cotações (F1.7 · ESPECIFICAÇÃO §1.6 D5).
//
// Uso:
//   npm run quotes:deploy     → deploy da edge function `quotes` no Supabase
//   npm run quotes:cron       → imprime o SQL do agendamento já preenchido
//                               (cole no SQL Editor do Supabase e execute)
//
// Lê do .env (gitignored): SUPABASE_FUNCTION_URL (ref do projeto),
// SUPABASE_SERVICE_ROLE_KEY (Authorization do cron) e QUOTES_CRON_SCHEDULE.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Carrega as variáveis de um arquivo .env simples (sem lib). */
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

/**
 * Ref do projeto Supabase extraído de SUPABASE_FUNCTION_URL.
 * Aceita formatos com e sem `.supabase.co` (ex.: `https://<ref>.functions`)
 * — extrai o primeiro subdomínio alfanumérico.
 */
function projectRef() {
  const url = env.SUPABASE_FUNCTION_URL || "";
  const match = url.match(/https:\/\/([a-z0-9]+)/);
  if (!match) {
    console.error(
      "[ERRO] Nao foi possivel extrair o project ref de SUPABASE_FUNCTION_URL no .env",
    );
    console.error("       Ex.: SUPABASE_FUNCTION_URL=https://<ref>.supabase.co/functions/v1");
    process.exit(1);
  }
  return match[1];
}

/** URL canônica base das edge functions: https://<ref>.supabase.co/functions/v1. */
function functionBaseUrl() {
  return `https://${projectRef()}.supabase.co/functions/v1`;
}

function deploy() {
  const ref = projectRef();
  console.log(`[deploy] project ref: ${ref}`);
  console.log("[deploy] rodando: supabase functions deploy quotes --project-ref <ref>");
  execSync(`npx supabase functions deploy quotes --project-ref ${ref}`, {
    cwd: root,
    stdio: "inherit",
  });
  console.log(`[deploy] pronto. Teste manual:`);
  console.log(`  curl -X POST '${functionBaseUrl()}/quotes' \\`);
  console.log(`    -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"`);
  console.log(`[deploy] proximo passo: npm run quotes:cron`);
}

function cron() {
  const functionUrl = `${functionBaseUrl()}/quotes`;
  const schedule = (env.QUOTES_CRON_SCHEDULE || "0 */6 * * *").split(/\s+#/)[0].trim();
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!serviceRole) {
    console.error("[ERRO] SUPABASE_SERVICE_ROLE_KEY ausente no .env (necessario para o cron).");
    process.exit(1);
  }

  const sql = `-- ============================================================================
-- CRON — Edge function de cotações (F1.7) — GERADO por scripts/deploy-quotes.mjs
-- Cole este bloco no SQL Editor do Supabase (Dashboard > SQL Editor) e execute.
-- Requer as extensões pg_cron e pg_net (Dashboard > Database > Extensions).
-- ============================================================================

-- 1) Remove agendamento anterior, se existir (idempotente).
select cron.unschedule('quotes-6h')
where exists (select 1 from cron.job where jobname = 'quotes-6h');

-- 2) Agenda a atualização (${schedule}).
select cron.schedule(
  'quotes-6h',
  '${schedule}',
  $cron$
    select net.http_post(
      url := '${functionUrl}',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ${serviceRole}'
      ),
      body := '{}'
    );
  $cron$
);

-- 3) Verificação: select jobid, jobname, schedule, active from cron.job order by jobid;
`;
  console.log(sql);
}

const cmd = process.argv[2] ?? "";
if (cmd === "deploy") deploy();
else if (cmd === "cron") cron();
else {
  console.error("Uso: npm run quotes:deploy | npm run quotes:cron");
  process.exit(1);
}
