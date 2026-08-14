import type { PostgrestError } from "@supabase/supabase-js";

export interface QueryResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Executa um builder do supabase-js com cast controlado do resultado.
 *
 * O parser de seleção do supabase-js (select-query-parser) é frágil com Row
 * complexos (unions/nullables) e emite `SelectQueryError`. Aqui o contrato de
 * tipos vem do nosso `Database` (fonte única) e o supabase-js fica apenas
 * como transporte. O `error` real (PostgrestError) é preservado intacto.
 */
export async function resolveQuery<T>(builder: PromiseLike<unknown>): Promise<QueryResult<T>> {
  return (await builder) as unknown as QueryResult<T>;
}
