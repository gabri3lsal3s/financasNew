import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "@/lib/env";

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
 * Cliente único do Supabase (Online First — sem camadas locais de persistência).
 *
 * Lazy: o import não lança; a primeira chamada valida o env (mensagem clara se
 * faltar configuração). Em testes, use `vi.mock("@/data/client")`.
 */
export function getSupabase(): Supabase {
  if (!client) {
    const { url, anonKey } = getSupabaseEnv();
    client = createClient<Database, "public">(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }) as Supabase;
  }
  return client;
}
