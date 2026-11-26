import { AppError, classifyError } from "@/services/errors";
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

/** Cursor por id evita deslocamento de páginas quando registros anteriores são excluídos. */
export async function readAllPages<T extends { id: string }>(
  fetchPage: (afterId: string | null, pageSize: number) => PromiseLike<QueryResult<T[]>>,
  signal?: AbortSignal,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  let afterId: string | null = null;
  for (;;) {
    signal?.throwIfAborted();
    const { data, error } = await fetchPage(afterId, pageSize);
    signal?.throwIfAborted();
    if (error) {
      if (error.message.includes("AbortError")) throw new DOMException("The user aborted a request.", "AbortError");
      const classified = classifyError(error);
      throw new AppError(classified.kind, classified.message, error);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
    afterId = page[page.length - 1]!.id;
  }
}
