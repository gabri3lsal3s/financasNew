/**
 * Motor Puro de Reconciliação Familiar em Centavos.
 *
 * Módulo de domínio financeiro responsável pelo fechamento orçamentário da casa:
 *   1. Consolidação exata dos gastos em centavos inteiros (BRL);
 *   2. Apuração de totais e ticket médio por pagador;
 *   3. Distribuição de cotas devidas (Fair Share) por divisão equitativa (50/50 ou 1/N)
 *      ou proporcional à renda/proporção via Algoritmo do Maior Resto (Hamilton-Hare);
 *   4. Cálculo de saldo líquido individual (crédito/débito) com balanço de soma-zero;
 *   5. Monitoramento de saúde do teto mensal (comfort, warning, danger, exceeded);
 *   6. Projeção temporal de ritmo diário (daily run-rate) e previsão de esgotamento;
 *   7. Salvaguarda F5: Auditoria de despesas lançadas após o acerto do mês;
 *   8. Verificação formal de invariantes contábeis de dupla entrada.
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md §3).
 * Moeda tratada estritamente em centavos inteiros (FINANCIAL_MATH_SPEC.md §1).
 */

import { normalizePercentagesTo100 } from "../reports/distribution";
import { MAX_MONEY_CENTS } from "../validation/sanitization";

// ===========================================================================
// 1. Tipos e Contratos de Domínio
// ===========================================================================

export type HouseholdSplitRule = "equal" | "proportional" | "combined";

export type HouseholdHealthStatus = "comfort" | "warning" | "danger" | "exceeded";

export interface ReconciliationMemberInput {
  user_id: string;
  display_name?: string | null;
  role?: string | null;
  split_ratio?: number | null;
  income_cents?: number | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
}

export interface ReconciliationExpenseInput {
  id: string;
  user_id: string;
  amount_cents: number;
  date: string;
  description?: string;
  category_id?: string | null;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  created_at?: string;
  is_family?: boolean;
}

export interface ReconciliationIncomeInput {
  id?: string;
  user_id: string;
  amount_cents: number;
  date?: string;
  description?: string;
}

export interface ReconciliationSettlementInput {
  id?: string;
  settled_at: string;
  payer_id?: string;
  receiver_id?: string;
  amount_cents?: number;
  payment_method?: string;
  notes?: string | null;
}

export interface HouseholdReconciliationOptions {
  referenceDate?: Date | string;
  month?: string; // Formato YYYY-MM
  splitRule?: HouseholdSplitRule;
}

export interface HouseholdReconciliationParams {
  monthly_ceiling_cents: number;
  members: readonly ReconciliationMemberInput[];
  expenses: readonly ReconciliationExpenseInput[];
  incomes?: readonly ReconciliationIncomeInput[];
  settlement?: ReconciliationSettlementInput | null;
  options?: HouseholdReconciliationOptions;
}

export interface MemberSpendingReconciliation {
  user_id: string;
  display_name: string;
  role: string;
  spent_cents: number;
  percentage_of_spent: number;
  display_percentage_of_spent: string;
  expenses_count: number;
  average_ticket_cents: number;
  target_ratio: number;
  target_percentage: number;
  fair_share_cents: number;
  net_balance_cents: number;
  is_top_spender: boolean;
  is_creditor: boolean;
  is_debtor: boolean;
  is_balanced: boolean;
  pix_key?: string | null;
  pix_key_type?: string | null;
}

export interface HouseholdPaceProjection {
  days_in_month: number;
  day_of_month: number;
  days_remaining: number;
  daily_pace_cents: number;
  projected_month_end_cents: number;
  projected_difference_cents: number;
  is_projected_to_exceed: boolean;
  projected_exhaustion_day: number | null;
}

export interface PostSettlementAudit {
  has_post_settlement_expenses: boolean;
  post_settlement_spent_cents: number;
  post_settlement_expenses_count: number;
  post_settlement_expenses: ReconciliationExpenseInput[];
}

export interface HouseholdHealthEvaluation {
  spent_percentage: number;
  display_spent_percentage: string;
  status: HouseholdHealthStatus;
  status_label: string;
  is_exceeded: boolean;
  is_near_limit: boolean;
}

export interface HouseholdReconciliationResult {
  month: string;
  monthly_ceiling_cents: number;
  total_spent_cents: number;
  total_income_cents: number;
  remaining_ceiling_cents: number;
  net_household_cashflow_cents: number;
  health: HouseholdHealthEvaluation;
  members: MemberSpendingReconciliation[];
  top_spender_id: string | null;
  split_rule_applied: HouseholdSplitRule;
  pace_projection: HouseholdPaceProjection;
  post_settlement_audit: PostSettlementAudit;
  is_fully_settled: boolean;
  is_balanced: boolean;
}

export interface HouseholdInvariantsValidation {
  valid: boolean;
  errors: string[];
}

// ===========================================================================
// 2. Metadados Canônicos de Saúde Orçamentária (pt-BR sem emojis)
// ===========================================================================

export const HOUSEHOLD_HEALTH_METADATA: Record<
  HouseholdHealthStatus,
  { label: string; tone: "positive" | "warning" | "critical" }
> = {
  comfort: {
    label: "Confortável",
    tone: "positive",
  },
  warning: {
    label: "Atenção ao teto",
    tone: "warning",
  },
  danger: {
    label: "Alerta crítico",
    tone: "critical",
  },
  exceeded: {
    label: "Teto ultrapassado",
    tone: "critical",
  },
};

// ===========================================================================
// 3. Utilitários de Data e Competência Pura
// ===========================================================================

const MONTH_REGEX = /^(\d{4})-(\d{2})/;

/**
 * Decompõe uma string de mês 'YYYY-MM' ou calcula a partir da data de referência.
 */
export function resolveCompetenceMonthParts(
  monthStr?: string,
  referenceDate?: Date | string,
): { year: number; monthIndex: number; formattedMonth: string } {
  if (monthStr) {
    const match = monthStr.match(MONTH_REGEX);
    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const formattedMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      return { year, monthIndex, formattedMonth };
    }
  }

  const d =
    referenceDate instanceof Date
      ? referenceDate
      : typeof referenceDate === "string"
        ? new Date(referenceDate)
        : new Date();

  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safeDate.getFullYear();
  const monthIndex = safeDate.getMonth();
  const formattedMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return { year, monthIndex, formattedMonth };
}

/**
 * Retorna a quantidade de dias no mês da competência informada.
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Sanitiza um valor financeiro em centavos inteiros não-negativos.
 */
export function sanitizeCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (rounded <= 0) return 0;
  return Math.min(rounded, MAX_MONEY_CENTS);
}

// ===========================================================================
// 4. Somatórios e Saúde da Casa
// ===========================================================================

/**
 * Calcula o total gasto conjunto da casa em centavos inteiros.
 */
export function calculateTotalSpentCents(
  expenses: readonly { amount_cents?: number }[],
): number {
  let total = 0;
  for (const exp of expenses) {
    total += sanitizeCents(exp.amount_cents);
  }
  return total;
}

/**
 * Calcula o total de receitas compartilhadas da casa em centavos inteiros.
 */
export function calculateTotalIncomeCents(
  incomes?: readonly { amount_cents?: number }[],
): number {
  if (!incomes || incomes.length === 0) return 0;
  let total = 0;
  for (const inc of incomes) {
    total += sanitizeCents(inc.amount_cents);
  }
  return total;
}

/**
 * Avalia o status e percentual de consumo do teto da casa.
 */
export function evaluateHouseholdHealth(
  totalSpentCents: number,
  monthlyCeilingCents: number,
): HouseholdHealthEvaluation {
  const safeSpent = sanitizeCents(totalSpentCents);
  const safeCeiling = sanitizeCents(monthlyCeilingCents);

  if (safeCeiling === 0) {
    if (safeSpent === 0) {
      return {
        spent_percentage: 0,
        display_spent_percentage: "0,0%",
        status: "comfort",
        status_label: "Sem gastos registrados",
        is_exceeded: false,
        is_near_limit: false,
      };
    }
    return {
      spent_percentage: 100,
      display_spent_percentage: "100,0%",
      status: "exceeded",
      status_label: "Sem teto definido",
      is_exceeded: true,
      is_near_limit: true,
    };
  }

  const rawPercentage = (safeSpent / safeCeiling) * 100;
  const spent_percentage = Number(rawPercentage.toFixed(1));
  const display_spent_percentage = `${spent_percentage.toFixed(1).replace(".", ",")}%`;

  let status: HouseholdHealthStatus;
  if (rawPercentage > 100) {
    status = "exceeded";
  } else if (rawPercentage > 90) {
    status = "danger";
  } else if (rawPercentage >= 75) {
    status = "warning";
  } else {
    status = "comfort";
  }

  const meta = HOUSEHOLD_HEALTH_METADATA[status];

  return {
    spent_percentage,
    display_spent_percentage,
    status,
    status_label: meta.label,
    is_exceeded: status === "exceeded",
    is_near_limit: status === "warning" || status === "danger" || status === "exceeded",
  };
}

// ===========================================================================
// 5. Motor de Cotas Justas em Centavos (Fair Share Math)
// ===========================================================================

export interface FairShareMemberTarget {
  user_id: string;
  target_ratio: number;
}

/**
 * Resolve as proporções alvo de rateio para cada membro da família.
 */
export function resolveTargetRatios(
  members: readonly ReconciliationMemberInput[],
  splitRule: HouseholdSplitRule,
): FairShareMemberTarget[] {
  if (members.length === 0) return [];
  const firstMember = members[0];
  if (members.length === 1 && firstMember) {
    return [{ user_id: firstMember.user_id, target_ratio: 1.0 }];
  }

  if (splitRule === "proportional") {
    // 1. Tenta usar split_ratio pré-definido nos membros
    const hasExplicitRatios = members.some(
      (m) => typeof m.split_ratio === "number" && m.split_ratio > 0,
    );

    if (hasExplicitRatios) {
      const sumRatios = members.reduce(
        (acc, m) => acc + (typeof m.split_ratio === "number" && m.split_ratio > 0 ? m.split_ratio : 0),
        0,
      );

      if (sumRatios > 0) {
        return members.map((m) => {
          const ratioVal = typeof m.split_ratio === "number" && m.split_ratio > 0 ? m.split_ratio : 0;
          return {
            user_id: m.user_id,
            target_ratio: ratioVal / sumRatios,
          };
        });
      }
    }

    // 2. Tenta usar income_cents (renda declarada)
    const hasIncome = members.some(
      (m) => typeof m.income_cents === "number" && m.income_cents > 0,
    );

    if (hasIncome) {
      const sumIncome = members.reduce(
        (acc, m) => acc + (typeof m.income_cents === "number" && m.income_cents > 0 ? m.income_cents : 0),
        0,
      );

      if (sumIncome > 0) {
        return members.map((m) => {
          const inc = typeof m.income_cents === "number" && m.income_cents > 0 ? m.income_cents : 0;
          return {
            user_id: m.user_id,
            target_ratio: inc / sumIncome,
          };
        });
      }
    }
  }

  // Divisão equitativa (equal): 1/N
  const equalRatio = 1 / members.length;
  return members.map((m) => ({
    user_id: m.user_id,
    target_ratio: equalRatio,
  }));
}

/**
 * Calcula a cota devida (fair share) em centavos inteiros para cada participante,
 * aplicando o Algoritmo do Maior Resto (Hamilton-Hare) para distribuir o resíduo
 * euclidiano centavo a centavo sem criar ou perder qualquer fração de valor.
 *
 * Invariante Sagrada: soma(fair_shares) === totalSpentCents.
 */
export function calculateFairSharesCents(
  totalSpentCents: number,
  targetRatios: readonly FairShareMemberTarget[],
): Record<string, number> {
  const result: Record<string, number> = {};
  if (targetRatios.length === 0) return result;

  const safeTotal = sanitizeCents(totalSpentCents);
  if (safeTotal === 0) {
    for (const target of targetRatios) {
      result[target.user_id] = 0;
    }
    return result;
  }

  const firstTarget = targetRatios[0];
  if (targetRatios.length === 1 && firstTarget) {
    result[firstTarget.user_id] = safeTotal;
    return result;
  }

  // 1. Alocação da parte inteira de centavos e isolamento de restos fracionários
  interface TempShare {
    user_id: string;
    originalIndex: number;
    floorCents: number;
    remainder: number;
  }

  const tempShares: TempShare[] = targetRatios.map((target, originalIndex) => {
    const exactCents = safeTotal * target.target_ratio;
    const floorCents = Math.floor(exactCents);
    const remainder = exactCents - floorCents;

    return {
      user_id: target.user_id,
      originalIndex,
      floorCents,
      remainder,
    };
  });

  const sumFloor = tempShares.reduce((acc, s) => acc + s.floorCents, 0);
  const leftoverCents = safeTotal - sumFloor;

  // 2. Ordena pelo maior resto (desempate pelo índice original estável)
  const sortedByRemainder = [...tempShares].sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return a.originalIndex - b.originalIndex;
  });

  // 3. Distribui os centavos restantes para os maiores restos
  const bonusSet = new Set<string>();
  for (let i = 0; i < leftoverCents; i++) {
    const candidate = sortedByRemainder[i % sortedByRemainder.length];
    if (candidate) {
      bonusSet.add(candidate.user_id);
    }
  }

  for (const s of tempShares) {
    const bonus = bonusSet.has(s.user_id) ? 1 : 0;
    result[s.user_id] = s.floorCents + bonus;
  }

  return result;
}

// ===========================================================================
// 6. Projeção de Ritmo Diário da Casa (Daily Run-Rate)
// ===========================================================================

/**
 * Calcula a projeção de ritmo diário e estimativa de esgotamento do teto da casa.
 */
export function calculateHouseholdPace(
  totalSpentCents: number,
  monthlyCeilingCents: number,
  options?: HouseholdReconciliationOptions,
): HouseholdPaceProjection {
  const { year, monthIndex } = resolveCompetenceMonthParts(
    options?.month,
    options?.referenceDate,
  );

  const daysInMonth = getDaysInMonth(year, monthIndex);

  const refDate =
    options?.referenceDate instanceof Date
      ? options.referenceDate
      : typeof options?.referenceDate === "string"
        ? new Date(options.referenceDate)
        : new Date();

  const safeRefDate = Number.isNaN(refDate.getTime()) ? new Date() : refDate;

  // Determina o dia corrente de referência
  let dayOfMonth: number;
  if (
    safeRefDate.getFullYear() === year &&
    safeRefDate.getMonth() === monthIndex
  ) {
    dayOfMonth = Math.min(Math.max(1, safeRefDate.getDate()), daysInMonth);
  } else if (
    safeRefDate.getFullYear() > year ||
    (safeRefDate.getFullYear() === year && safeRefDate.getMonth() > monthIndex)
  ) {
    // Competência passada fechada
    dayOfMonth = daysInMonth;
  } else {
    // Competência futura
    dayOfMonth = 1;
  }

  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);
  const safeSpent = sanitizeCents(totalSpentCents);
  const safeCeiling = sanitizeCents(monthlyCeilingCents);

  // Ritmo diário em centavos
  const dailyPaceCents = dayOfMonth > 0 ? Math.round(safeSpent / dayOfMonth) : 0;
  const projectedMonthEndCents = dailyPaceCents * daysInMonth;
  const projectedDifferenceCents = projectedMonthEndCents - safeCeiling;
  const isProjectedToExceed = safeCeiling > 0 && projectedMonthEndCents > safeCeiling;

  // Dia estimado de esgotamento do teto
  let projectedExhaustionDay: number | null = null;
  if (safeCeiling > 0) {
    if (safeSpent >= safeCeiling) {
      projectedExhaustionDay = dayOfMonth;
    } else if (dailyPaceCents > 0) {
      const estimatedDay = Math.ceil(safeCeiling / dailyPaceCents);
      if (estimatedDay <= daysInMonth) {
        projectedExhaustionDay = estimatedDay;
      }
    }
  }

  return {
    days_in_month: daysInMonth,
    day_of_month: dayOfMonth,
    days_remaining: daysRemaining,
    daily_pace_cents: dailyPaceCents,
    projected_month_end_cents: projectedMonthEndCents,
    projected_difference_cents: projectedDifferenceCents,
    is_projected_to_exceed: isProjectedToExceed,
    projected_exhaustion_day: projectedExhaustionDay,
  };
}

// ===========================================================================
// 7. Salvaguarda Arquitetural F5: Auditoria Pós-Acerto
// ===========================================================================

/**
 * Audita a lista de despesas em busca de lançamentos retroativos ou alterações
 * ocorridas após o registro oficial de acerto financeiro do mês (F5).
 */
export function auditPostSettlementActivity(
  expenses: readonly ReconciliationExpenseInput[],
  settlement?: ReconciliationSettlementInput | null,
): PostSettlementAudit {
  if (!settlement || !settlement.settled_at) {
    return {
      has_post_settlement_expenses: false,
      post_settlement_spent_cents: 0,
      post_settlement_expenses_count: 0,
      post_settlement_expenses: [],
    };
  }

  const settledTime = new Date(settlement.settled_at).getTime();
  if (Number.isNaN(settledTime)) {
    return {
      has_post_settlement_expenses: false,
      post_settlement_spent_cents: 0,
      post_settlement_expenses_count: 0,
      post_settlement_expenses: [],
    };
  }

  const postExpenses: ReconciliationExpenseInput[] = [];
  let postSpentCents = 0;

  for (const exp of expenses) {
    // Dá precedência ao created_at (timestamp de auditoria no banco);
    // se ausente, analisa a data informada no formato ISO.
    let expTime: number;
    if (exp.created_at) {
      expTime = new Date(exp.created_at).getTime();
    } else {
      expTime = new Date(`${exp.date}T23:59:59.999Z`).getTime();
    }

    if (!Number.isNaN(expTime) && expTime > settledTime) {
      postExpenses.push(exp);
      postSpentCents += sanitizeCents(exp.amount_cents);
    }
  }

  return {
    has_post_settlement_expenses: postExpenses.length > 0,
    post_settlement_spent_cents: postSpentCents,
    post_settlement_expenses_count: postExpenses.length,
    post_settlement_expenses: postExpenses,
  };
}

// ===========================================================================
// 8. Validação Formal de Invariantes Contábeis
// ===========================================================================

/**
 * Valida formalmente a preservação das invariantes contábeis de dupla entrada:
 *   1. Soma dos gastos por membro === total gasto da casa;
 *   2. Soma das cotas devidas (fair shares) === total gasto da casa;
 *   3. Soma dos saldos líquidos individuais (net balances) === 0 (balanço fechado);
 *   4. Soma dos percentuais normalizados fecha em 100,0% quando há gastos;
 *   5. Saldo restante do teto === teto - total gasto;
 *   6. Resultado de caixa === receitas - despesas.
 */
export function validateHouseholdReconciliationInvariants(
  result: HouseholdReconciliationResult,
): HouseholdInvariantsValidation {
  const errors: string[] = [];

  // 1. Soma dos gastos por membro === total gasto
  const sumMembersSpent = result.members.reduce((acc, m) => acc + m.spent_cents, 0);
  if (sumMembersSpent !== result.total_spent_cents) {
    errors.push(
      `Invariante violada: soma dos gastos dos membros (${sumMembersSpent}) diverge do total gasto (${result.total_spent_cents}).`,
    );
  }

  // 2. Soma das cotas devidas === total gasto
  const sumFairShares = result.members.reduce((acc, m) => acc + m.fair_share_cents, 0);
  if (sumFairShares !== result.total_spent_cents) {
    errors.push(
      `Invariante violada: soma das cotas devidas (${sumFairShares}) diverge do total gasto (${result.total_spent_cents}).`,
    );
  }

  // 3. Soma dos saldos líquidos === 0
  const sumNetBalances = result.members.reduce((acc, m) => acc + m.net_balance_cents, 0);
  if (sumNetBalances !== 0) {
    errors.push(
      `Invariante violada: balanço líquido dos membros não zera (${sumNetBalances} centavos de resíduo).`,
    );
  }

  // 4. Percentuais fecham em 100,0% quando há gastos
  if (result.total_spent_cents > 0 && result.members.length > 0) {
    const sumPercentages = result.members.reduce((acc, m) => acc + m.percentage_of_spent, 0);
    const diff = Math.abs(sumPercentages - 100.0);
    if (diff > 0.15) {
      errors.push(
        `Invariante violada: soma dos percentuais normalizados (${sumPercentages.toFixed(1)}%) diverge de 100,0%.`,
      );
    }
  }

  // 5. Saldo restante do teto
  const expectedRemaining = result.monthly_ceiling_cents - result.total_spent_cents;
  if (result.remaining_ceiling_cents !== expectedRemaining) {
    errors.push(
      `Invariante violada: saldo restante (${result.remaining_ceiling_cents}) diverge da subtração (${expectedRemaining}).`,
    );
  }

  // 6. Resultado operacional de caixa da casa
  const expectedCashflow = result.total_income_cents - result.total_spent_cents;
  if (result.net_household_cashflow_cents !== expectedCashflow) {
    errors.push(
      `Invariante violada: fluxo de caixa líquido (${result.net_household_cashflow_cents}) diverge da apuração (${expectedCashflow}).`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ===========================================================================
// 9. Orquestrador Principal Puro de Reconciliação Familiar
// ===========================================================================

/**
 * Executa a reconciliação completa do orçamento familiar em centavos inteiros.
 *
 * Consolida gastos individuais, calcula a fatia justa de cada parceiro,
 * apura a saúde do teto e projeta o ritmo de gastos até o final da competência.
 */
export function reconcileHouseholdSpending(
  params: HouseholdReconciliationParams,
): HouseholdReconciliationResult {
  const {
    monthly_ceiling_cents,
    members: rawMembers,
    expenses,
    incomes,
    settlement,
    options,
  } = params;

  const { formattedMonth } = resolveCompetenceMonthParts(
    options?.month,
    options?.referenceDate,
  );

  const safeCeilingCents = sanitizeCents(monthly_ceiling_cents);
  const totalSpentCents = calculateTotalSpentCents(expenses);
  const totalIncomeCents = calculateTotalIncomeCents(incomes);
  const remainingCeilingCents = safeCeilingCents - totalSpentCents;
  const netHouseholdCashflowCents = totalIncomeCents - totalSpentCents;

  const splitRule: HouseholdSplitRule = options?.splitRule ?? "equal";

  // Garante que membros participantes existam (incluindo pagadores não-cadastrados se houver)
  const memberMap = new Map<string, ReconciliationMemberInput>();
  for (const m of rawMembers) {
    memberMap.set(m.user_id, m);
  }

  for (const exp of expenses) {
    if (exp.user_id && !memberMap.has(exp.user_id)) {
      memberMap.set(exp.user_id, {
        user_id: exp.user_id,
        display_name: "Participante Convidado",
        role: "member",
      });
    }
  }

  // Se houver transações de renda informadas, acumula por membro para proporcionalidade
  const incomeByMember = new Map<string, number>();
  if (incomes && incomes.length > 0) {
    for (const inc of incomes) {
      if (inc.user_id) {
        const cents = sanitizeCents(inc.amount_cents);
        const curr = incomeByMember.get(inc.user_id) ?? 0;
        incomeByMember.set(inc.user_id, curr + cents);
      }
    }
  }

  const effectiveMembers = Array.from(memberMap.values()).map((m) => {
    if (m.income_cents === undefined || m.income_cents === null || m.income_cents <= 0) {
      const accumulated = incomeByMember.get(m.user_id);
      if (accumulated && accumulated > 0) {
        return { ...m, income_cents: accumulated };
      }
    }
    return m;
  });

  // 1. Agrupamento de gastos por membro
  interface MemberSpendAcc {
    spent_cents: number;
    count: number;
  }
  const spendingByMember = new Map<string, MemberSpendAcc>();
  for (const m of effectiveMembers) {
    spendingByMember.set(m.user_id, { spent_cents: 0, count: 0 });
  }

  for (const exp of expenses) {
    const cents = sanitizeCents(exp.amount_cents);
    const current = spendingByMember.get(exp.user_id);
    if (current) {
      current.spent_cents += cents;
      current.count += 1;
    }
  }

  // 2. Normalização dos percentuais de gasto de cada participante (Hamilton-Hare)
  const rawPercentageInputs = effectiveMembers.map((m) => {
    const spent = spendingByMember.get(m.user_id)?.spent_cents ?? 0;
    const rawPct = totalSpentCents > 0 ? (spent / totalSpentCents) * 100 : 0;
    return {
      user_id: m.user_id,
      rawPct,
    };
  });

  const normalizedPercentages = normalizePercentagesTo100(rawPercentageInputs, 1);
  const pctMap = new Map<string, { pct: number; display: string }>();
  for (const item of normalizedPercentages) {
    pctMap.set(item.user_id, {
      pct: item.formattedPct,
      display: item.displayPctStr,
    });
  }

  // 3. Resolução de Proporções Alvo e Cálculo de Cotas Devidas (Fair Share)
  const targetRatios = resolveTargetRatios(effectiveMembers, splitRule);
  const targetRatioMap = new Map<string, number>();
  for (const tr of targetRatios) {
    targetRatioMap.set(tr.user_id, tr.target_ratio);
  }

  const fairShares = calculateFairSharesCents(totalSpentCents, targetRatios);

  // 4. Identificação do maior pagador
  let topSpenderId: string | null = null;
  let maxSpent = -1;
  for (const m of effectiveMembers) {
    const spent = spendingByMember.get(m.user_id)?.spent_cents ?? 0;
    if (spent > maxSpent && spent > 0) {
      maxSpent = spent;
      topSpenderId = m.user_id;
    }
  }

  // 5. Construção dos resumos individuais por participante
  const membersResult: MemberSpendingReconciliation[] = effectiveMembers.map((m) => {
    const spendAcc = spendingByMember.get(m.user_id) ?? { spent_cents: 0, count: 0 };
    const spentCents = spendAcc.spent_cents;
    const expensesCount = spendAcc.count;
    const averageTicketCents =
      expensesCount > 0 ? Math.round(spentCents / expensesCount) : 0;

    const normPct = pctMap.get(m.user_id) ?? { pct: 0, display: "0,0%" };
    const targetRatio = targetRatioMap.get(m.user_id) ?? (1 / Math.max(1, effectiveMembers.length));
    const targetPercentage = Number((targetRatio * 100).toFixed(1));
    const isCombined = splitRule === "combined";
    const fairShareCents = isCombined ? spentCents : (fairShares[m.user_id] ?? 0);
    const netBalanceCents = isCombined ? 0 : (spentCents - fairShareCents);

    const isCreditor = !isCombined && netBalanceCents > 0;
    const isDebtor = !isCombined && netBalanceCents < 0;
    const isBalanced = isCombined || netBalanceCents === 0;

    return {
      user_id: m.user_id,
      display_name: m.display_name?.trim() || "Participante",
      role: m.role || "member",
      spent_cents: spentCents,
      percentage_of_spent: normPct.pct,
      display_percentage_of_spent: normPct.display,
      expenses_count: expensesCount,
      average_ticket_cents: averageTicketCents,
      target_ratio: targetRatio,
      target_percentage: targetPercentage,
      fair_share_cents: fairShareCents,
      net_balance_cents: netBalanceCents,
      is_top_spender: m.user_id === topSpenderId,
      is_creditor: isCreditor,
      is_debtor: isDebtor,
      is_balanced: isBalanced,
      pix_key: m.pix_key ?? null,
      pix_key_type: m.pix_key_type ?? null,
    };
  });

  // Ordena os membros: maior pagador primeiro
  membersResult.sort((a, b) => b.spent_cents - a.spent_cents);

  // 6. Avaliação de saúde orçamentária do teto da casa
  const health = evaluateHouseholdHealth(totalSpentCents, safeCeilingCents);

  // 7. Projeção de ritmo diário e esgotamento
  const paceProjection = calculateHouseholdPace(
    totalSpentCents,
    safeCeilingCents,
    options,
  );

  // 8. Auditoria de atividades pós-acerto (F5)
  const postSettlementAudit = auditPostSettlementActivity(expenses, settlement);

  // 9. Status de equilíbrio contábil
  const isBalanced = membersResult.every((m) => m.net_balance_cents === 0);
  const isFullySettled = settlement != null && !postSettlementAudit.has_post_settlement_expenses;

  return {
    month: formattedMonth,
    monthly_ceiling_cents: safeCeilingCents,
    total_spent_cents: totalSpentCents,
    total_income_cents: totalIncomeCents,
    remaining_ceiling_cents: remainingCeilingCents,
    net_household_cashflow_cents: netHouseholdCashflowCents,
    health,
    members: membersResult,
    top_spender_id: topSpenderId,
    split_rule_applied: splitRule,
    pace_projection: paceProjection,
    post_settlement_audit: postSettlementAudit,
    is_fully_settled: isFullySettled,
    is_balanced: isBalanced,
  };
}
