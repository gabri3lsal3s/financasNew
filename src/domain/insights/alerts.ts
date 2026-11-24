/**
 * Alertas críticos — ESPECIFICAÇÃO §3.7.1.
 *
 * Prioridade fixa (1–6) e apenas os alertas VERDADEIROS entram na saída,
 * já ordenados para exibição. Motor puro — nenhuma consulta aqui.
 */

export type AlertSeverity = "critical" | "warning" | "praise" | "info";

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
  /** Despesas do período (centavos) — opcional para validação direta de consumo sem renda. */
  expenseCents?: number;
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
  /** Dia atual do mês (1..31) para contextualizar a temporalidade. */
  dayOfMonth?: number;
  /** Total de dias do mês (28..31). */
  daysInMonth?: number;
  /** Obrigações pendentes contratadas do ciclo (faturas abertas + dívidas a pagar em centavos). */
  committedObligationsCents?: number;
  /** Taxa de poupança efetiva do ciclo (considerando compromissos pendentes). */
  cycleSavingsRatePercent?: number;
  /** Indica se a referência orçamentária usa estimativa provisória/histórica (ex.: recebimento fracionado). */
  isProvisionalReference?: boolean;
}

const CRITICAL_RITMO = 1.05; // > 5% acima do esperado
const BURN_LIMIT = 85; // > 85% da renda
const PRAISE_MIN_SAVINGS = 20; // ≥ 20% da renda

/** Gera os alertas verdadeiros, ordenados por prioridade. */
export function criticalAlerts(input: CriticalAlertInput): InsightAlert[] {
  const effectiveExpenseCents =
    input.expenseCents != null
      ? input.expenseCents
      : input.incomeCents - input.balanceCents;

  const hasNoIncomeWithExpenses = input.incomeCents <= 0 && effectiveExpenseCents > 0;

  // Root-Cause Deduplication: quando não há renda registrada, o usuário não deve
  // receber múltiplos alertas redundantes (saldo negativo, burn_rate, ritmo e déficit).
  if (hasNoIncomeWithExpenses) {
    return [
      {
        id: "sem_renda_registrada",
        priority: 1,
        severity: "info",
        title: "Aguardando registro de renda no mês",
        description:
          "Você já registrou despesas neste período, mas ainda não há entradas de renda. Cadastre suas receitas para liberar diagnósticos completos de ritmo, poupança e projeção.",
      },
    ];
  }

  const alerts: InsightAlert[] = [];
  const provisionalSuffix = input.isProvisionalReference
    ? " (estimativa baseada em referência provisória/histórica)"
    : "";

  if (input.balanceCents < 0) {
    alerts.push({
      id: "saldo_negativo",
      priority: 1,
      severity: "critical",
      title: "Despesas acima das receitas do período",
      description: "As saídas registradas até o momento superaram as entradas confirmadas deste ciclo.",
    });
  }

  if (input.paceRatio > CRITICAL_RITMO) {
    alerts.push({
      id: "ritmo_gastos",
      priority: 2,
      severity: "warning",
      title: "Ritmo de gastos acima do esperado",
      description: `O consumo acumulado está ${((input.paceRatio - 1) * 100).toFixed(0)}% acima do ritmo esperado para a data${provisionalSuffix}.`,
    });
  }

  if (input.overspentBudgets > 0) {
    alerts.push({
      id: "limites_estourados",
      priority: 3,
      severity: "warning",
      title: "Orçamentos acima do teto",
      description:
        input.overspentBudgets === 1
          ? "1 categoria ultrapassou o teto definido para o mês."
          : `${input.overspentBudgets} categorias ultrapassaram o teto definido para o mês.`,
    });
  }

  if (input.incomeCents > 0 && input.burnRatePercent > BURN_LIMIT) {
    alerts.push({
      id: "burn_rate",
      priority: 4,
      severity: "warning",
      title: "Gastos acima de 85% da renda",
      description: `As despesas consomem ${input.burnRatePercent.toFixed(0)}% da renda registrada${provisionalSuffix}.`,
    });
  }

  if (input.projectedDeficit) {
    alerts.push({
      id: "deficit_projetado",
      priority: 5,
      severity: "warning",
      title: "Projeção de fechamento pressionada",
      description: `No ritmo atual, o fechamento do mês tende a ficar apertado${provisionalSuffix}. Vale revisar os próximos gastos variáveis.`,
    });
  }

  const effectiveCommitted = Math.max(0, input.committedObligationsCents ?? 0);
  const cycleBalanceCents = input.balanceCents - effectiveCommitted;
  const effectiveSavingsRate =
    input.cycleSavingsRatePercent !== undefined
      ? input.cycleSavingsRatePercent
      : input.incomeCents > 0
        ? (cycleBalanceCents / input.incomeCents) * 100
        : 0;

  const isIntraMonth =
    input.dayOfMonth !== undefined &&
    input.daysInMonth !== undefined &&
    input.dayOfMonth < Math.min(25, input.daysInMonth);

  if (input.incomeCents > 0 && effectiveSavingsRate >= PRAISE_MIN_SAVINGS) {
    const description = isIntraMonth
      ? `Ritmo de poupança saudável: Projetando poupar ${effectiveSavingsRate.toFixed(0)}% da renda após as obrigações do ciclo.`
      : `Você poupou ${effectiveSavingsRate.toFixed(0)}% da renda — acima de 20%. Continue assim!`;

    alerts.push({
      id: "poupanca_saudavel",
      priority: 6,
      severity: "praise",
      title: "Poupança saudável",
      description,
    });
  }

  return alerts.sort((a, b) => a.priority - b.priority);
}
