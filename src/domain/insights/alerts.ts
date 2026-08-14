/**
 * Alertas críticos — ESPECIFICAÇÃO §3.7.1.
 *
 * Prioridade fixa (1–6) e apenas os alertas VERDADEIROS entram na saída,
 * já ordenados para exibição. Motor puro — nenhuma consulta aqui.
 */

export type AlertSeverity = "critical" | "warning" | "praise";

export interface InsightAlert {
  /** Chave estável (usada também como occurrence_key no aprendizado). */
  id: string;
  /** 1 = mais grave … 6 = elogio. */
  priority: number;
  severity: AlertSeverity;
  title: string;
  description: string;
}

export interface CriticalAlertInput {
  /** Saldo do período (centavos). */
  balanceCents: number;
  /** Renda do período (centavos). */
  incomeCents: number;
  /** Ritmo de gastos: acumulado ÷ esperado (1 = no trilho). */
  paceRatio: number;
  /** Quantidade de orçamentos estourados (> 100%). */
  overspentBudgets: number;
  /** Burn rate: despesas ÷ renda × 100. */
  burnRatePercent: number;
  /** Déficit projetado para o fim do mês (dia ≥ 10 e fora do trilho). */
  projectedDeficit: boolean;
  /** Taxa de poupança (saldo ÷ rendas × 100). */
  savingsRatePercent: number;
}

const CRITICAL_RITMO = 1.05; // > 5% acima do esperado
const BURN_LIMIT = 85; // > 85% da renda
const PRAISE_MIN_SAVINGS = 20; // ≥ 20% da renda

/** Gera os alertas verdadeiros, ordenados por prioridade. */
export function criticalAlerts(input: CriticalAlertInput): InsightAlert[] {
  const alerts: InsightAlert[] = [];

  if (input.balanceCents < 0) {
    alerts.push({
      id: "saldo_negativo",
      priority: 1,
      severity: "critical",
      title: "Saldo negativo",
      description: "Suas despesas superaram as receitas neste período.",
    });
  }

  if (input.paceRatio > CRITICAL_RITMO) {
    alerts.push({
      id: "ritmo_gastos",
      priority: 2,
      severity: "warning",
      title: "Ritmo de gastos acima do esperado",
      description: `O consumo acumulado está ${((input.paceRatio - 1) * 100).toFixed(0)}% acima do previsto para o período.`,
    });
  }

  if (input.overspentBudgets > 0) {
    alerts.push({
      id: "limites_estourados",
      priority: 3,
      severity: "warning",
      title: "Orçamentos estourados",
      description:
        input.overspentBudgets === 1
          ? "1 categoria excedeu o limite definido."
          : `${input.overspentBudgets} categorias excederam o limite definido.`,
    });
  }

  if (input.burnRatePercent > BURN_LIMIT) {
    alerts.push({
      id: "burn_rate",
      priority: 4,
      severity: "critical",
      title: "Burn rate alto",
      description: `As despesas consomem ${input.burnRatePercent.toFixed(0)}% da renda — acima de 85%.`,
    });
  }

  if (input.projectedDeficit) {
    alerts.push({
      id: "deficit_projetado",
      priority: 5,
      severity: "warning",
      title: "Déficit projetado para o fim do mês",
      description: "No ritmo atual, o mês deve fechar no vermelho. Reveja os gastos restantes.",
    });
  }

  if (input.savingsRatePercent >= PRAISE_MIN_SAVINGS) {
    alerts.push({
      id: "poupanca_saudavel",
      priority: 6,
      severity: "praise",
      title: "Poupança saudável",
      description: `Você poupou ${input.savingsRatePercent.toFixed(0)}% da renda — acima de 20%. Continue assim! 🎉`,
    });
  }

  return alerts.sort((a, b) => a.priority - b.priority);
}
