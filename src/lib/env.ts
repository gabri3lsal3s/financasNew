/**
 * Módulo de env — única fonte das variáveis do cliente (VITE_*).
 *
 * Falha com mensagem clara quando a configuração está incompleta (Fase 1 do
 * ROADMAP). Nunca expõe segredos do servidor (service role): essas
 * variáveis existem apenas fora do bundle (edge functions / migrações).
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

const REQUIRED_VITE_VARS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const;

const KNOWN_PLACEHOLDERS = [
  "your-project.supabase.co",
  "https://your-project.supabase.co",
  "your-anon-key",
  "your-service-role-key",
];

export function getSupabaseEnv(): SupabaseEnv {
  const missing = REQUIRED_VITE_VARS.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Configuração incompleta: ${missing.join(", ")}. Copie .env.example para .env.local e preencha com as credenciais do projeto Supabase (Settings > API).`,
    );
  }

  const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

  if (KNOWN_PLACEHOLDERS.some((p) => url.includes(p) || anonKey.includes(p))) {
    throw new Error(
      "Configuração inválida: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY contém valores padrão de placeholder. Configure as credenciais reais do projeto.",
    );
  }

  return {
    url,
    anonKey,
  };
}
