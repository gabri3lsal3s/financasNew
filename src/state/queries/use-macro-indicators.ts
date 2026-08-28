import { useQuery } from "@tanstack/react-query";
import { fetchBcbIndicator } from "@/services/quotes";
import { DEFAULT_ANNUAL_CDI_RATE } from "@/domain/portfolio";
import { STALE_TIMES } from "@/state/cache-policy";

export const MACRO_INDICATORS_QUERY_KEY = ["macro_indicators"] as const;

export interface MacroIndicatorsData {
  annualCdiRate: number;
  annualSelicRate: number;
}

/**
 * Consulta e armazena em cache os indicadores macroeconômicos oficiais
 * do Banco Central (SGS):
 *   • Série 12: CDI Diário / Anualizado
 *   • Série 432: Selic Meta (% a.a.)
 */
export function useMacroIndicators() {
  return useQuery({
    queryKey: MACRO_INDICATORS_QUERY_KEY,
    queryFn: async (): Promise<MacroIndicatorsData> => {
      const [cdi, selic] = await Promise.all([
        fetchBcbIndicator("CDI"),
        fetchBcbIndicator("SELIC"),
      ]);

      return {
        annualCdiRate: cdi !== null && cdi > 0 ? cdi : DEFAULT_ANNUAL_CDI_RATE,
        annualSelicRate: selic !== null && selic > 0 ? selic : (cdi ?? DEFAULT_ANNUAL_CDI_RATE),
      };
    },
    staleTime: STALE_TIMES.static, // Taxas do BCB mudam diariamente/por reunião do Copom
  });
}
