/**
 * Política de cache do TanStack Query — F23 (Engenharia de Performance) e Plano de Alta Concorrência (§1.2).
 *
 * Fonte única da calibração de `staleTime`/`gcTime` por tipo de dado:
 *   • **estático/cadastral** — categorias, preferências, orçamentos, planos e permissões:
 *     mudam raramente e são invalidadas nas mutações locais ou via Realtime → 5 min
 *     de staleness (300.000 ms) + gcTime longo (30 min);
 *   • **analítico** — agregados (overview, busca global, portfolio/ledger,
 *     feedback de insights, lembretes): 60 s;
 *   • **cotações** — preços de ativos (cache servidor da edge + override
 *     manual): 60 s;
 *   • **transacional** — despesas, receitas, dívidas: 30 s a 60 s
 *     (dados operacionais que mudam a cada lançamento).
 *
 * A calibração global em `AppProviders` opera com `refetchOnWindowFocus: false`
 * para prevenir refetch storms em acessos concorrentes e trocas de janelas/abas.
 */

export const STALE_TIMES = {
  /** Dados estáticos/cadastrais de referência (categorias, orçamentos, preferências, permissões…). */
  static: 5 * 60_000,
  /** Agregados analíticos (overview, busca, posições/ledger). */
  analytical: 60_000,
  /** Cotações de ativos (cache servidor + override manual). */
  quotes: 60_000,
  /** Dados transacionais (despesas, receitas, dívidas). */
  transactional: 30_000,
} as const;

/** gcTime dos dados estáticos — permanecem no cache após desmontar a tela. */
export const STATIC_GC_TIME = 30 * 60_000;
