import { useQuery } from "@tanstack/react-query";
import { fetchBcbIndicator } from "@/services/quotes";
import { DEFAULT_ANNUAL_CDI_RATE } from "@/domain/portfolio";
import { STALE_TIMES } from "@/state/cache-policy";

export const MACRO_INDICATORS_QUERY_KEY = ["macro_indicators"] as const;

export interface MacroIndicatorsData {
  annualCdiRate: number;
  annualSelicRate: number;
  annualIpcaRate: number;
  ibovPeriodReturnPct?: number;
}

/**
 * Consulta e armazena em cache os indicadores macroeconômicos oficiais
 * do Banco Central (SGS) e mercado de capitais:
 *   • Série 12: CDI Diário / Anualizado
 *   • Série 432: Selic Meta (% a.a.)
 *   • Série 433: IPCA Inflação
 */
export function useMacroIndicators() {
  return useQuery({
    queryKey: MACRO_INDICATORS_QUERY_KEY,
    queryFn: async (): Promise<MacroIndicatorsData> => {
      const [cdi, selic, ipca] = await Promise.all([
        fetchBcbIndicator("CDI"),
        fetchBcbIndicator("SELIC"),
        fetchBcbIndicator("IPCA"),
      ]);

      return {
        annualCdiRate: cdi !== null && cdi > 0 ? cdi : DEFAULT_ANNUAL_CDI_RATE,
        annualSelicRate: selic !== null && selic > 0 ? selic : (cdi ?? DEFAULT_ANNUAL_CDI_RATE),
        annualIpcaRate: ipca !== null && ipca > 0 ? ipca : 4.0,
      };
    },
    staleTime: STALE_TIMES.static, // Taxas do BCB mudam diariamente/por reunião do Copom
  });
}
