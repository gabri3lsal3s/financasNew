/**
 * Módulo de env — única fonte das variáveis do cliente (VITE_*).
 *
 * Falha com mensagem clara quando a configuração está incompleta (Fase 1 do
 * ROADMAP). Nunca expõe segredos do servidor (service role, R2): essas
 * variáveis existem apenas fora do bundle (edge functions / migrações).
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

const REQUIRED_VITE_VARS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const;

export function getSupabaseEnv(): SupabaseEnv {
  const missing = REQUIRED_VITE_VARS.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Configuração incompleta: ${missing.join(", ")}. Copie .env.example para .env.local e preencha com as credenciais do projeto Supabase (Settings > API).`,
    );
  }
  return {
    url: import.meta.env.VITE_SUPABASE_URL ?? "",
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  };
}
