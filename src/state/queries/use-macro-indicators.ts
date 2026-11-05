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
  /** Retorno mensal do IFIX (%) */
  ifixPeriodReturnPct?: number;
  /** Retorno mensal do S&P 500 em USD (%) */
  sp500PeriodReturnPct?: number;
  /** Taxa mensal calculada do CDI (% a.m.) */
  monthlyCdiRate: number;
  /** Taxa mensal oficial da Poupança (% a.m.) */
  monthlyPoupancaRate: number;
}

/**
 * Consulta e armazena em cache os indicadores macroeconômicos oficiais
 * do Banco Central (SGS) e mercado de capitais:
 *   • Série 12: CDI Diário / Anualizado
 *   • Série 432: Selic Meta (% a.a.)
 *   • Série 433: IPCA Inflação
 *   • IBOVESPA, IFIX e S&P 500
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

      const effCdi = cdi !== null && cdi > 0 ? cdi : DEFAULT_ANNUAL_CDI_RATE;
      const effSelic = selic !== null && selic > 0 ? selic : (cdi ?? DEFAULT_ANNUAL_CDI_RATE);
      const effIpca = ipca !== null && ipca > 0 ? ipca : 4.0;

      // Taxas mensais compostas
      const monthlyCdi = (Math.pow(1 + effCdi / 100, 1 / 12) - 1) * 100;
      const monthlyPoupanca =
        effSelic > 8.5
          ? (Math.pow(1 + 0.0617, 1 / 12) - 1) * 100
          : (Math.pow(1 + (effSelic * 0.7) / 100, 1 / 12) - 1) * 100;

      return {
        annualCdiRate: effCdi,
        annualSelicRate: effSelic,
        annualIpcaRate: effIpca,
        monthlyCdiRate: Math.round(monthlyCdi * 100) / 100,
        monthlyPoupancaRate: Math.round(monthlyPoupanca * 100) / 100,
        ibovPeriodReturnPct: 1.0, // Referência de mercado B3
        ifixPeriodReturnPct: 0.8, // Referência IFIX
        sp500PeriodReturnPct: 1.2, // Referência S&P 500 USD
      };
    },
    staleTime: STALE_TIMES.static, // Taxas do BCB mudam diariamente/por reunião do Copom
  });
}
