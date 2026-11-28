import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "@/lib/env";
import { isSharedDeviceSession } from "@/services/session-policy";
import { isTabIsolatedSession } from "@/services/user-storage";

/**
 * Cliente tipado com o Schema REAL do Database.
 *
 * O `createClient` do supabase-js resolve o Schema por inferência de forma
 * frágil (cai na string "public"), quebrando os tipos de `.from()`/`.rpc()`.
 * Aqui o Schema é fixado explicitamente e o cast controla o retorno.
 */
export type Supabase = SupabaseClient<Database, "public", "public", Database["public"]>;

let client: Supabase | null = null;

/**
 * Em modo desenvolvimento (`vite dev`), roteia chamadas `/functions/v1/*` pelo proxy
 * local `/__supabase_functions/*` para evitar bloqueio de CORS quando o backend está
 * com `ASAAS_ENVIRONMENT=production` (que restringe `localhost` no CORS).
 */
function createDevFunctionsProxyFetch(supabaseUrl: string): typeof fetch | undefined {
  if (
    !import.meta.env.DEV ||
    import.meta.env.MODE !== "development" ||
    typeof window === "undefined"
  ) {
    return undefined;
  }

  const functionsPrefix = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/`;
  const baseFetch = globalThis.fetch.bind(globalThis);

  return (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (rawUrl.startsWith(functionsPrefix)) {
      const proxiedUrl = `${window.location.origin}/__supabase_functions/${rawUrl.slice(functionsPrefix.length)}`;
      if (input instanceof Request) {
        return baseFetch(new Request(proxiedUrl, input), init);
      }
      return baseFetch(proxiedUrl, init);
    }

    return baseFetch(input, init);
  };
}

/**
 * Cliente único do Supabase (Online First — sem camadas locais de persistência).
 *
 * Lazy: o import não lança; a primeira chamada valida o env (mensagem clara se
 * faltar configuração). Em testes, use `vi.mock("@/data/client")`.
 */
function clearLegacyPersistedSupabaseTokens(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // no-op
  }
}

/**
 * Reseta o singleton do cliente Supabase para reaplicar a política de persistência
 * antes do próximo bootstrap (ex.: alternância para Computador Compartilhado).
 */
export function resetSupabaseClient(): void {
  client = null;
}

function createTabIsolatedAuthStorage() {
  return {
    getItem(key: string): string | null {
      if (typeof window === "undefined") return null;
      try {
        const tabValue = window.sessionStorage?.getItem(key) ?? null;
        if (tabValue !== null) return tabValue;
        if (isTabIsolatedSession()) return null;
        const localValue = window.localStorage.getItem(key);
        if (localValue !== null) {
          window.sessionStorage?.setItem(key, localValue);
        }
        return localValue;
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.setItem(key, value);
        if (!isTabIsolatedSession()) {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // no-op
      }
    },
    removeItem(key: string): void {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(key);
        if (!isTabIsolatedSession()) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // no-op
      }
    },
  };
}

export function getSupabase(): Supabase {
  if (!client) {
    const { url, anonKey } = getSupabaseEnv();
    const devFetch = createDevFunctionsProxyFetch(url);
    const sharedMode = isSharedDeviceSession();
    if (sharedMode) {
      clearLegacyPersistedSupabaseTokens();
    }
    client = createClient<Database, "public">(url, anonKey, {
      auth: {
        flowType: "pkce",
        persistSession: !sharedMode,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: createTabIsolatedAuthStorage(),
      },
      ...(devFetch ? { global: { fetch: devFetch } } : {}),
    }) as Supabase;
  }
  return client;
}

/**
 * Cria um cliente Supabase isolado e efêmero sem persistência de sessão em localStorage.
 * Essencial para operações de verificação de credenciais secundárias (ex.: validar senha
 * atual em verifyCurrentPassword) sem rebaixar ou sobrepor a sessão ativa (AAL2 para AAL1).
 */
export function createIsolatedSupabaseClient(): Supabase {
  const { url, anonKey } = getSupabaseEnv();
  return createClient<Database, "public">(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }) as Supabase;
}

