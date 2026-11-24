export interface QueryStatusLike {
  isLoading?: boolean;
  isPending?: boolean;
}

/**
 * Retorna true quando uma query habilitada ainda não concluiu a carga inicial.
 * Trata corretamente TanStack Query v5 (`isPending: true` mesmo antes de iniciar fetch)
 * e mocks parciais de teste que omitem `isPending` (retornando apenas `isLoading: false`).
 * Nunca retorna true durante background refetches (`isFetching: true, isPending: false`).
 */
export function isQueryPending(
  query: QueryStatusLike | null | undefined,
  enabled = true,
): boolean {
  if (!enabled || !query) return false;
  return Boolean(query.isLoading) || query.isPending === true;
}
