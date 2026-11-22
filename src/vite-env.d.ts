/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Versão oficial vigente do aplicativo (injetada pelo Vite a partir do package.json). */
declare const __APP_VERSION__: string;

/** Data e hora UTC da compilação do bundle (injetada pelo Vite). */
declare const __BUILD_TIMESTAMP__: string;

interface ImportMetaEnv {
  /** URL pública oficial da aplicação (ex.: https://axir.com.br). */
  readonly VITE_PUBLIC_SITE_URL?: string;
  /** URL do projeto Supabase (Settings > API). */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave pública anônima (anon key) do Supabase. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Provedor de faturamento padrão ativo ("asaas" ou "stripe"). */
  readonly VITE_DEFAULT_BILLING_PROVIDER?: string;
  /** Chave pública VAPID opcional para assinaturas Web Push no PWA. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
