/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (Settings > API). */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave pública anônima (anon key) do Supabase. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Provedor de faturamento padrão ativo ("asaas" ou "stripe"). */
  readonly VITE_DEFAULT_BILLING_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
