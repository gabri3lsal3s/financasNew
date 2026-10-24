/**
 * Script Automatizado de Pré-Voo & Health Check (Preflight Check)
 * Executa checagens rigorosas de ambiente, banco de dados Supabase,
 * integridade de schema, RPCs transacionais, cotações e compilação limpa.
 *
 * Uso:
 *   npx tsx scripts/preflight-check.ts
 *   npm run preflight
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CheckStatus = "SUCCESS" | "WARNING" | "FAILURE";

export interface CheckItem {
  id: string;
  name: string;
  status: CheckStatus;
  message: string;
  details?: string[];
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- Utilitários de Cores e Formatação de Terminal ---
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
};

export function formatStatusBadge(status: CheckStatus): string {
  switch (status) {
    case "SUCCESS":
      return `${colors.green}${colors.bold}[ SUCESSO ]${colors.reset}`;
    case "WARNING":
      return `${colors.yellow}${colors.bold}[ ALERTA  ]${colors.reset}`;
    case "FAILURE":
      return `${colors.red}${colors.bold}[ FALHA   ]${colors.reset}`;
  }
}

/** Carrega variáveis de ambiente a partir de arquivos .env sem bibliotecas externas. */
export function loadEnvFiles(): Record<string, string> {
  const loaded: Record<string, string> = {};
  const candidates = [join(rootDir, ".env"), join(rootDir, ".env.local")];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (match && match[1] && match[2] !== undefined) {
          const key = match[1];
          const rawVal = match[2].split(/\s+#/)[0]?.trim() ?? "";
          const cleanVal = rawVal.replace(/^["']|["']$/g, "");
          loaded[key] = cleanVal;
        }
      }
    } catch {
      // Ignora erro de leitura silenciosamente
    }
  }

  // Permite que variáveis do process.env sobreponham o arquivo
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) {
      loaded[k] = v;
    }
  }

  return loaded;
}

// --- 1. Checagem de Versão do Node.js ---
export function compareSemver(current: string, required: string): number {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const [cMaj = 0, cMin = 0, cPatch = 0] = parse(current);
  const [rMaj = 0, rMin = 0, rPatch = 0] = parse(required);

  if (cMaj !== rMaj) return cMaj - rMaj;
  if (cMin !== rMin) return cMin - rMin;
  return cPatch - rPatch;
}

export function checkNodeVersion(
  currentVersion: string = process.versions.node,
  nvmrcPath: string = join(rootDir, ".nvmrc"),
): CheckItem {
  let required = "22.23.4";
  if (existsSync(nvmrcPath)) {
    try {
      const fileContent = readFileSync(nvmrcPath, "utf8").trim();
      if (fileContent) required = fileContent;
    } catch {
      // Usa fallback
    }
  }

  const diff = compareSemver(currentVersion, required);
  const [cMaj = 0] = currentVersion.split(".").map((n) => parseInt(n, 10));

  if (cMaj < 22) {
    return {
      id: "node_version",
      name: "Ambiente Local e Node.js",
      status: "FAILURE",
      message: `Node.js v${currentVersion} incompatível (exige versão ≥ 22.23.4 conforme .nvmrc e engines).`,
    };
  }

  if (diff < 0) {
    return {
      id: "node_version",
      name: "Ambiente Local e Node.js",
      status: "WARNING",
      message: `Node.js v${currentVersion} ativo. Recomendado v${required} para paridade estrita de security releases.`,
    };
  }

  return {
    id: "node_version",
    name: "Ambiente Local e Node.js",
    status: "SUCCESS",
    message: `Node.js v${currentVersion} em conformidade estrita (≥ ${required}).`,
  };
}

// --- 2. Checagem de Variáveis de Ambiente ---
export function checkEnvironmentVariables(envMap: Record<string, string | undefined>): CheckItem {
  const missing: string[] = [];
  const warnings: string[] = [];

  const supabaseUrl = envMap.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    missing.push("VITE_SUPABASE_URL");
  } else if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
    missing.push("VITE_SUPABASE_URL (formato de URL inválido)");
  }

  const anonKey = envMap.VITE_SUPABASE_ANON_KEY;
  if (!anonKey || anonKey.length < 20) {
    missing.push("VITE_SUPABASE_ANON_KEY (ausente ou inválida)");
  }

  const billingProvider = envMap.VITE_DEFAULT_BILLING_PROVIDER;
  if (!billingProvider) {
    warnings.push("VITE_DEFAULT_BILLING_PROVIDER ausente (adotando 'asaas' por padrão)");
  } else if (!["asaas", "stripe"].includes(billingProvider.toLowerCase())) {
    warnings.push(`VITE_DEFAULT_BILLING_PROVIDER desconhecido ('${billingProvider}')`);
  }

  // Opcionais de produção
  if (!envMap.VITE_SENTRY_DSN) {
    warnings.push("VITE_SENTRY_DSN não configurado (observabilidade desativada em dev)");
  }

  if (missing.length > 0) {
    return {
      id: "env_vars",
      name: "Variáveis de Ambiente Críticas",
      status: "FAILURE",
      message: `Variáveis obrigatórias ausentes: ${missing.join(", ")}`,
      details: missing,
    };
  }

  if (warnings.length > 0) {
    return {
      id: "env_vars",
      name: "Variáveis de Ambiente Críticas",
      status: "SUCCESS",
      message: "Variáveis obrigatórias presentes (com avisos não impeditivos)",
      details: warnings,
    };
  }

  return {
    id: "env_vars",
    name: "Variáveis de Ambiente Críticas",
    status: "SUCCESS",
    message: "Todas as variáveis de ambiente validadas com sucesso.",
  };
}

// --- 3. Conexão com o Supabase ---
export async function checkSupabaseConnectivity(supabase: SupabaseClient): Promise<CheckItem> {
  try {
    // 1. Auth Ping
    const authPromise = supabase.auth.getSession();
    // 2. REST Ping leve
    const restPromise = supabase.from("categories").select("id").limit(1);

    const [authResult, restResult] = await Promise.all([authPromise, restPromise]);

    if (authResult.error) {
      return {
        id: "supabase_connection",
        name: "Conexão com o Supabase",
        status: "FAILURE",
        message: `Falha na API de Autenticação do Supabase: ${authResult.error.message}`,
      };
    }

    if (restResult.error && restResult.error.code !== "PGRST116") {
      // Se der erro de conexão de rede
      return {
        id: "supabase_connection",
        name: "Conexão com o Supabase",
        status: "FAILURE",
        message: `Falha de conexão REST com o Supabase: ${restResult.error.message}`,
      };
    }

    return {
      id: "supabase_connection",
      name: "Conexão com o Supabase",
      status: "SUCCESS",
      message: "Endpoints de Auth e PostgREST conectados e responsivos.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      id: "supabase_connection",
      name: "Conexão com o Supabase",
      status: "FAILURE",
      message: `Não foi possível conectar ao Supabase: ${errorMsg}. Verifique as credenciais ou inicie o banco local com 'npm run db:start'.`,
    };
  }
}

// --- 4. Integridade de Esquema (Tabelas Críticas) ---
export async function checkSchemaIntegrity(supabase: SupabaseClient): Promise<CheckItem> {
  const criticalTables = [
    "profiles",
    "categories",
    "expenses",
    "user_subscriptions",
    "support_tickets",
  ];

  const missingTables: string[] = [];

  for (const table of criticalTables) {
    try {
      const { error } = await supabase.from(table).select("id").limit(1);
      if (error && error.code === "42P01") {
        // Código Postgres para "relation does not exist"
        missingTables.push(table);
      }
    } catch {
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    return {
      id: "schema_integrity",
      name: "Integridade de Esquema de Banco",
      status: "FAILURE",
      message: `Tabelas críticas não encontradas no banco: ${missingTables.join(", ")}. Execute 'npm run db:push' ou aplique as migrações SQL.`,
      details: missingTables,
    };
  }

  return {
    id: "schema_integrity",
    name: "Integridade de Esquema de Banco",
    status: "SUCCESS",
    message: `Todas as 5 tabelas críticas validadas (${criticalTables.join(", ")}).`,
  };
}

// --- 5. Integridade de RPCs ---
export async function checkRpcIntegrity(supabase: SupabaseClient): Promise<CheckItem> {
  try {
    const { error } = await supabase.rpc("get_my_subscription");
    // Se o código for 42883 (function does not exist), a RPC não está instalada
    if (error && error.code === "42883") {
      return {
        id: "rpc_integrity",
        name: "Integridade de Funções RPC",
        status: "FAILURE",
        message: "RPC 'public.get_my_subscription()' não encontrada no banco. Aplique a migração 0040.",
      };
    }

    return {
      id: "rpc_integrity",
      name: "Integridade de Funções RPC",
      status: "SUCCESS",
      message: "RPC 'public.get_my_subscription()' registrada e operacional.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      id: "rpc_integrity",
      name: "Integridade de Funções RPC",
      status: "FAILURE",
      message: `Erro ao testar RPCs: ${msg}`,
    };
  }
}

// --- 6. Status do Cache de Cotações ---
export async function checkQuotesCache(supabase: SupabaseClient): Promise<CheckItem> {
  try {
    const { data, error } = await supabase
      .from("asset_prices")
      .select("ticker, price, updated_at")
      .is("user_id", null)
      .limit(10);

    if (error) {
      return {
        id: "quotes_cache",
        name: "Cache Global de Cotações (B3 / Mercado)",
        status: "WARNING",
        message: `Não foi possível verificar a tabela asset_prices: ${error.message}`,
      };
    }

    if (!data || data.length === 0) {
      return {
        id: "quotes_cache",
        name: "Cache Global de Cotações (B3 / Mercado)",
        status: "WARNING",
        message: "Tabela asset_prices sem registros consolidados (user_id is null). Execute 'npm run quotes:cron' para popular.",
      };
    }

    return {
      id: "quotes_cache",
      name: "Cache Global de Cotações (B3 / Mercado)",
      status: "SUCCESS",
      message: `Cache populado com ${data.length}+ cotações ativas. Última atualização: ${data[0]?.updated_at ?? "recente"}.`,
    };
  } catch (err: unknown) {
    return {
      id: "quotes_cache",
      name: "Cache Global de Cotações (B3 / Mercado)",
      status: "WARNING",
      message: `Aviso ao consultar cotações: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// --- 7. Integridade do Build (TypeScript & ESLint) ---
export function checkBuildIntegrity(): CheckItem {
  try {
    execSync("npm run typecheck", { stdio: "pipe", cwd: rootDir });
  } catch (err: unknown) {
    return {
      id: "build_typecheck",
      name: "Compilação TypeScript Estrita (tsc -b)",
      status: "FAILURE",
      message: "Falha na verificação de tipagem TypeScript.",
      details: [err instanceof Error ? err.message : String(err)],
    };
  }

  try {
    execSync("npm run lint", { stdio: "pipe", cwd: rootDir });
  } catch (err: unknown) {
    return {
      id: "build_typecheck",
      name: "Verificação de Linting (eslint .)",
      status: "FAILURE",
      message: "Falha na análise estática de código ESLint.",
      details: [err instanceof Error ? err.message : String(err)],
    };
  }

  return {
    id: "build_typecheck",
    name: "Integridade de Código (Typecheck & Lint)",
    status: "SUCCESS",
    message: "TypeScript (tsc -b) e ESLint aprovados com 0 erros e 0 alertas.",
  };
}

// --- Execução Principal do Preflight ---
export async function runPreflight(options: { skipBuildCheck?: boolean } = {}): Promise<{
  items: CheckItem[];
  successCount: number;
  warningCount: number;
  failureCount: number;
  passed: boolean;
}> {
  const items: CheckItem[] = [];
  const envMap = loadEnvFiles();

  // 1. Checagem Node.js
  items.push(checkNodeVersion());

  // 2. Checagem Variáveis de Ambiente
  const envCheck = checkEnvironmentVariables(envMap);
  items.push(envCheck);

  // 3 a 6. Checagens do Supabase (apenas se variáveis presentes)
  if (envMap.VITE_SUPABASE_URL && envMap.VITE_SUPABASE_ANON_KEY) {
    const supabase = createClient(envMap.VITE_SUPABASE_URL, envMap.VITE_SUPABASE_ANON_KEY);

    items.push(await checkSupabaseConnectivity(supabase));
    items.push(await checkSchemaIntegrity(supabase));
    items.push(await checkRpcIntegrity(supabase));
    items.push(await checkQuotesCache(supabase));
  } else {
    items.push({
      id: "supabase_connection",
      name: "Conexão com o Supabase",
      status: "FAILURE",
      message: "Pendente configuração de VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    });
  }

  // 7. Checagem de Build / Tipagem
  if (!options.skipBuildCheck) {
    items.push(checkBuildIntegrity());
  }

  const successCount = items.filter((i) => i.status === "SUCCESS").length;
  const warningCount = items.filter((i) => i.status === "WARNING").length;
  const failureCount = items.filter((i) => i.status === "FAILURE").length;
  const passed = failureCount === 0;

  return {
    items,
    successCount,
    warningCount,
    failureCount,
    passed,
  };
}

// Execução direta via CLI
async function main() {
  const startTime = Date.now();

  console.log(`\n${colors.cyan}${colors.bold}============================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}   ÁXIS FINANCE — AUDITORIA DE PRÉ-VOO & HEALTH CHECK      ${colors.reset}`);
  console.log(`${colors.dim}   Verificação de prontidão para produção e primeiros clientes${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}============================================================${colors.reset}\n`);

  const { items, successCount, warningCount, failureCount, passed } = await runPreflight();

  for (const item of items) {
    const badge = formatStatusBadge(item.status);
    console.log(`${badge} ${colors.bold}${item.name}${colors.reset}`);
    console.log(`           ${colors.dim}${item.message}${colors.reset}`);
    if (item.details && item.details.length > 0) {
      for (const d of item.details) {
        console.log(`           ${colors.dim}- ${d}${colors.reset}`);
      }
    }
    console.log("");
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`${colors.cyan}------------------------------------------------------------${colors.reset}`);
  console.log(
    `Total: ${items.length} checagens | ${colors.green}${successCount} sucesso${colors.reset} | ${colors.yellow}${warningCount} alerta(s)${colors.reset} | ${colors.red}${failureCount} falha(s)${colors.reset} (${durationSec}s)`,
  );

  if (passed) {
    console.log(`\n${colors.green}${colors.bold}[APROVADO] Sistema em conformidade operacional para Go-Live!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`\n${colors.red}${colors.bold}[REPROVADO] Existem falhas críticas que impedem o lançamento.${colors.reset}\n`);
    process.exit(1);
  }
}

// Inicia se executado diretamente
const isDirectCall =
  process.argv[1] &&
  (process.argv[1].endsWith("preflight-check.ts") || process.argv[1].endsWith("preflight-check.js"));

if (isDirectCall) {
  main().catch((err) => {
    console.error("Erro fatal ao executar preflight check:", err);
    process.exit(1);
  });
}
