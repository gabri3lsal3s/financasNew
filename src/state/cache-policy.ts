/**
 * Política de cache do TanStack Query — F23 (Engenharia de Performance).
 *
 * Fonte única da calibração de `staleTime`/`gcTime` por tipo de dado:
 *   • **estático** — categorias, cartões, pagamentos, metas de alocação,
 *     preferências: mudam raramente e são invalidadas nas mutações → 5 min
 *     de staleness + gcTime longo (sobrevivem à navegação entre telas);
 *   • **analítico** — agregados (overview, busca global, portfolio/ledger,
 *     feedback de insights, lembretes): 60 s;
 *   • **cotações** — preços de ativos (cache servidor da edge + override
 *     manual): 60 s;
 *   • **transacional** — despesas, receitas, dívidas, orçamentos: 30 s
 *     (dados que mudam a cada lançamento).
 *
 * Nenhuma query é `refetchOnWindowFocus: false` — a invalidação por mutação
 * mantém a consistência; o staleTime só evita refetch redundante em trocas
 * rápidas de aba (objetivo da F23).
 */

export const STALE_TIMES = {
  /** Dados estáticos de referência (categorias, cartões, metas…). */
  static: 5 * 60_000,
  /** Agregados analíticos (overview, busca, posições/ledger). */
  analytical: 60_000,
  /** Cotações de ativos (cache servidor + override manual). */
  quotes: 60_000,
  /** Dados transacionais (despesas, receitas, dívidas, orçamentos). */
  transactional: 30_000,
} as const;

/** gcTime dos dados estáticos — permanecem no cache após desmontar a tela. */
export const STATIC_GC_TIME = 30 * 60_000;
