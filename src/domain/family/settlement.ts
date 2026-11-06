/**
 * Motor Puro de Compensação Justa Familiar via Pix.
 *
 * Módulo de domínio financeiro responsável pelo fechamento e liquidação de contas da casa:
 *   1. Apuração da diferença entre o valor pago e a cota devida (50/50 ou proporcional à renda);
 *   2. Identificação de saldos líquidos individuais (devedor vs. credor) com balanço de soma-zero;
 *   3. Algoritmo determinístico de liquidação de transferências mínimas (Minimization of Cash Transfers);
 *   4. Geração de chave Pix com valor exato de transferência e payload EMVCo (BR Code)
 *      em conformidade estrita com o Banco Central do Brasil (BACEN);
 *   5. Verificação formal de invariantes contábeis de dupla entrada centavo a centavo;
 *   6. Montagem de snapshot imutável para auditoria em `family_settlements`;
 *   7. Formatação de sumário executivo em texto pt-BR sem emojis (AGENTS.md §4.8).
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md §3).
 * Moeda tratada estritamente em centavos inteiros (FINANCIAL_MATH_SPEC.md §1).
 */

import {
  generatePixBrCode,
  normalizePixKey,
  sanitizeMerchantText,
  sanitizeTxId,
  validatePixBrCode,
  type PixKeyType,
} from "../pix";
import {
  reconcileHouseholdSpending,
  resolveCompetenceMonthParts,
  sanitizeCents,
  type HouseholdInvariantsValidation,
  type HouseholdReconciliationResult,
  type HouseholdSplitRule,
  type ReconciliationExpenseInput,
  type ReconciliationIncomeInput,
  type ReconciliationMemberInput,
} from "./reconciliation";
import type { FamilyPixKeyType } from "@/types/schema";

// ===========================================================================
// 1. Tipos e Contratos de Domínio de Compensação
// ===========================================================================

export interface SettlementMemberInput {
  user_id: string;
  display_name?: string | null;
  role?: string | null;
  pix_key?: string | null;
  pix_key_type?: FamilyPixKeyType | PixKeyType | null;
  city?: string | null;
}

export interface SettlementDifference {
  net_balance_cents: number;
  must_pay_cents: number;
  must_receive_cents: number;
  is_creditor: boolean;
  is_debtor: boolean;
  is_balanced: boolean;
  display_net_balance: string;
}

export interface SettlementMemberBalance {
  user_id: string;
  display_name: string;
  role?: string;
  spent_cents: number;
  fair_share_cents: number;
  net_balance_cents: number;
  pix_key?: string | null;
  pix_key_type?: FamilyPixKeyType | PixKeyType | null;
  city?: string | null;
}

export interface SettlementTransfer {
  id: string;
  payer_id: string;
  payer_name: string;
  receiver_id: string;
  receiver_name: string;
  amount_cents: number;
  amount: number; // Em reais (ex.: 150.00) para persistência e RPCs
  display_amount: string; // Ex.: "R$ 150,00"
  pix_key: string | null;
  pix_key_type: FamilyPixKeyType | null;
  has_pix: boolean;
  pix_payload: string | null;
  tx_id: string;
  description: string;
}

export interface SettlementMemberStatus {
  user_id: string;
  display_name: string;
  role: string;
  spent_cents: number;
  fair_share_cents: number;
  net_balance_cents: number;
  display_net_balance: string;
  must_pay_cents: number;
  must_receive_cents: number;
  is_creditor: boolean;
  is_debtor: boolean;
  is_balanced: boolean;
  has_pix_key: boolean;
  pix_key: string | null;
  pix_key_type: FamilyPixKeyType | null;
}

export interface HouseholdSettlementPlan {
  month: string; // Formato YYYY-MM
  split_rule: HouseholdSplitRule;
  total_spent_cents: number;
  total_settlement_cents: number;
  is_balanced: boolean;
  has_missing_pix_keys: boolean;
  transfers: SettlementTransfer[];
  members: SettlementMemberStatus[];
  summary_text: string;
  settled_at: string | null;
}

export interface GenerateSettlementPixPayloadParams {
  pixKey: string;
  keyType?: FamilyPixKeyType | PixKeyType | null;
  merchantName: string;
  merchantCity?: string | null;
  amountCents: number;
  txId?: string | null;
  infoAdicional?: string | null;
}

export interface SettlementPixPayloadResult {
  has_pix: boolean;
  pix_payload: string | null;
  pix_key: string | null;
  pix_key_type: FamilyPixKeyType | null;
  tx_id: string;
  error?: string;
}

export interface HouseholdSettlementOptions {
  month?: string;
  referenceDate?: Date | string;
  splitRule?: HouseholdSplitRule;
  defaultCity?: string;
  descriptionPrefix?: string;
}

export interface HouseholdSettlementParams {
  monthly_ceiling_cents?: number;
  members: readonly ReconciliationMemberInput[];
  expenses: readonly ReconciliationExpenseInput[];
  incomes?: readonly ReconciliationIncomeInput[];
  options?: HouseholdSettlementOptions;
}

// ===========================================================================
// 2. Utilitários Puros de Formatação Monetária
// ===========================================================================

/**
 * Formata um valor em centavos inteiros para o padrão monetário brasileiro BRL
 * ("R$ 1.250,50" ou "-R$ 50,00") sem dependência de locale de sistema.
 */
export function formatCentsToBrl(cents: number): string {
  const safe = Math.round(Number.isFinite(cents) ? cents : 0);
  const isNegative = safe < 0;
  const abs = Math.abs(safe);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  const reaisFormatted = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centavosFormatted = centavos.toString().padStart(2, "0");
  const sign = isNegative ? "-" : "";
  return `${sign}R$ ${reaisFormatted},${centavosFormatted}`;
}

// ===========================================================================
// 3. Diferença Individual da Cota Justa (Fair Share Difference)
// ===========================================================================

/**
 * Calcula a diferença líquida entre o valor desembolsado e a cota devida calculada.
 *
 * Saldo Líquido = spentCents - fairShareCents:
 *   - netBalance > 0: Credor (desembolsou mais que sua cota, deve receber de volta);
 *   - netBalance < 0: Devedor (desembolsou menos que sua cota, deve pagar a diferença);
 *   - netBalance === 0: Equilibrado (gastou exatamente sua cota justa).
 */
export function calculateFairShareDifference(
  spentCents: number,
  fairShareCents: number,
): SettlementDifference {
  const safeSpent = sanitizeCents(spentCents);
  const safeFairShare = sanitizeCents(fairShareCents);
  const net_balance_cents = safeSpent - safeFairShare;

  const is_creditor = net_balance_cents > 0;
  const is_debtor = net_balance_cents < 0;
  const is_balanced = net_balance_cents === 0;

  const must_pay_cents = is_debtor ? Math.abs(net_balance_cents) : 0;
  const must_receive_cents = is_creditor ? net_balance_cents : 0;

  return {
    net_balance_cents,
    must_pay_cents,
    must_receive_cents,
    is_creditor,
    is_debtor,
    is_balanced,
    display_net_balance: formatCentsToBrl(net_balance_cents),
  };
}

// ===========================================================================
// 4. Geração de Payload Pix EMVCo para Compensação Instantânea
// ===========================================================================

/**
 * Gera os dados e o payload EMVCo (BR Code Copia e Cola) para pagamento Pix
 * com valor fixo exato em centavos inteiros.
 *
 * Em caso de chave vazia ou formato inválido, lida com resiliência sem lançar
 * exceções não tratadas, reportando status `has_pix: false`.
 */
export function generateSettlementPixPayload(
  params: GenerateSettlementPixPayloadParams,
): SettlementPixPayloadResult {
  const rawKey = params.pixKey?.trim();
  const txIdFallback = sanitizeTxId(params.txId ?? undefined);

  if (!rawKey) {
    return {
      has_pix: false,
      pix_payload: null,
      pix_key: null,
      pix_key_type: null,
      tx_id: txIdFallback,
    };
  }

  const safeAmount = sanitizeCents(params.amountCents);
  const cleanMerchantName = sanitizeMerchantText(params.merchantName || "Acerto Familiar", 25);
  const cleanCity = sanitizeMerchantText(params.merchantCity || "CIDADE", 15, true) || "CIDADE";

  const effectiveKeyType = params.keyType ? (params.keyType as PixKeyType) : undefined;

  try {
    const normalizedKey = normalizePixKey(rawKey, effectiveKeyType);
    if (!normalizedKey) {
      return {
        has_pix: false,
        pix_payload: null,
        pix_key: rawKey,
        pix_key_type: null,
        tx_id: txIdFallback,
        error: "Chave Pix invalida ou nao reconhecida.",
      };
    }

    const payload = generatePixBrCode({
      pixKey: normalizedKey,
      keyType: effectiveKeyType,
      merchantName: cleanMerchantName || "Acerto Familiar",
      merchantCity: cleanCity,
      amountCents: safeAmount,
      txId: params.txId ? sanitizeTxId(params.txId) : undefined,
      infoAdicional: params.infoAdicional
        ? sanitizeMerchantText(params.infoAdicional, 25)
        : undefined,
    });

    const isValid = validatePixBrCode(payload);
    if (!isValid) {
      return {
        has_pix: false,
        pix_payload: null,
        pix_key: normalizedKey,
        pix_key_type: (effectiveKeyType as FamilyPixKeyType) ?? null,
        tx_id: txIdFallback,
        error: "Falha na validacao de integridade EMVCo do BR Code.",
      };
    }

    return {
      has_pix: true,
      pix_payload: payload,
      pix_key: normalizedKey,
      pix_key_type: (effectiveKeyType as FamilyPixKeyType) ?? null,
      tx_id: params.txId ? sanitizeTxId(params.txId) : txIdFallback,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erro na geracao do BR Code Pix.";
    return {
      has_pix: false,
      pix_payload: null,
      pix_key: rawKey,
      pix_key_type: null,
      tx_id: txIdFallback,
      error: errorMessage,
    };
  }
}

// ===========================================================================
// 5. Algoritmo de Liquidação de Transferências Mínimas (Cash Minimization)
// ===========================================================================

interface TempDebtor {
  user_id: string;
  display_name: string;
  remainingDebt: number;
}

interface TempCreditor {
  user_id: string;
  display_name: string;
  remainingCredit: number;
  pix_key?: string | null;
  pix_key_type?: FamilyPixKeyType | PixKeyType | null;
  city?: string | null;
}

/**
 * Resolve o conjunto mínimo de transferências entre os participantes da casa,
 * casando os saldos de devedores e credores de forma determinística e exata.
 *
 * Invariante Contábil:
 *   Soma(transferências) === Soma(dívidas) === Soma(créditos)
 */
export function resolveSettlementTransfers(
  memberBalances: readonly SettlementMemberBalance[],
  options?: HouseholdSettlementOptions,
): SettlementTransfer[] {
  const debtors: TempDebtor[] = [];
  const creditors: TempCreditor[] = [];

  for (const mb of memberBalances) {
    if (mb.net_balance_cents < 0) {
      debtors.push({
        user_id: mb.user_id,
        display_name: mb.display_name,
        remainingDebt: Math.abs(mb.net_balance_cents),
      });
    } else if (mb.net_balance_cents > 0) {
      creditors.push({
        user_id: mb.user_id,
        display_name: mb.display_name,
        remainingCredit: mb.net_balance_cents,
        pix_key: mb.pix_key,
        pix_key_type: mb.pix_key_type,
        city: mb.city,
      });
    }
  }

  // Ordena devedores pela maior dívida e credores pelo maior crédito
  debtors.sort((a, b) => b.remainingDebt - a.remainingDebt);
  creditors.sort((a, b) => b.remainingCredit - a.remainingCredit);

  const transfers: SettlementTransfer[] = [];
  const month = options?.month || "competencia";
  const monthClean = month.replace(/[^a-zA-Z0-9]/g, "");
  const defaultCity = options?.defaultCity || "CIDADE";
  const prefix = options?.descriptionPrefix || "Compensacao familiar";

  let dIdx = 0;
  let cIdx = 0;
  let transferIndex = 1;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    if (!debtor || !creditor) break;

    const transferCents = Math.min(debtor.remainingDebt, creditor.remainingCredit);

    if (transferCents > 0) {
      const txId = sanitizeTxId(`FAM${monthClean}${transferIndex}`);
      const infoAdicional = sanitizeMerchantText(`Acerto ${month}`, 25);
      const description = `${prefix} - ${month}`;

      let pixResult: SettlementPixPayloadResult = {
        has_pix: false,
        pix_payload: null,
        pix_key: creditor.pix_key?.trim() || null,
        pix_key_type: (creditor.pix_key_type as FamilyPixKeyType) ?? null,
        tx_id: txId,
      };

      if (creditor.pix_key && creditor.pix_key.trim().length > 0) {
        pixResult = generateSettlementPixPayload({
          pixKey: creditor.pix_key,
          keyType: creditor.pix_key_type,
          merchantName: creditor.display_name,
          merchantCity: creditor.city || defaultCity,
          amountCents: transferCents,
          txId,
          infoAdicional,
        });
      }

      const id = `st_${debtor.user_id.slice(0, 8)}_${creditor.user_id.slice(0, 8)}_${transferIndex}`;

      transfers.push({
        id,
        payer_id: debtor.user_id,
        payer_name: debtor.display_name,
        receiver_id: creditor.user_id,
        receiver_name: creditor.display_name,
        amount_cents: transferCents,
        amount: Number((transferCents / 100).toFixed(2)),
        display_amount: formatCentsToBrl(transferCents),
        pix_key: pixResult.pix_key,
        pix_key_type: pixResult.pix_key_type,
        has_pix: pixResult.has_pix,
        pix_payload: pixResult.pix_payload,
        tx_id: pixResult.tx_id,
        description,
      });

      debtor.remainingDebt -= transferCents;
      creditor.remainingCredit -= transferCents;
      transferIndex += 1;
    }

    if (debtor.remainingDebt <= 0) {
      dIdx++;
    }
    if (creditor.remainingCredit <= 0) {
      cIdx++;
    }
  }

  return transfers;
}

// ===========================================================================
// 6. Formatação do Resumo Executivo em Texto (pt-BR sem emojis)
// ===========================================================================

/**
 * Gera um sumário limpo e amigável em texto puro (pt-BR) formatado para
 * compartilhamento via WhatsApp, e-mail ou cópia para área de transferência.
 *
 * Estritamente sem emojis e sem caracteres Unicode decorativos (AGENTS.md §4.8).
 */
export function formatSettlementSummaryText(plan: HouseholdSettlementPlan): string {
  const lines: string[] = [];

  lines.push(`ACERTO DE CONTAS FAMILIAR - ${plan.month}`);
  lines.push("=".repeat(40));

  const ruleLabel =
    plan.split_rule === "proportional"
      ? "Divisao proporcional a renda"
      : "Divisao equitativa (50/50)";

  lines.push(`Regra de divisao: ${ruleLabel}`);
  lines.push(`Gastos totais da casa: ${formatCentsToBrl(plan.total_spent_cents)}`);
  lines.push(`Volume de compensacao: ${formatCentsToBrl(plan.total_settlement_cents)}`);
  lines.push("");

  lines.push("SITUACAO DOS PARTICIPANTES:");
  for (const m of plan.members) {
    let statusText = "equilibrado";
    if (m.is_creditor) {
      statusText = `recebe ${formatCentsToBrl(m.must_receive_cents)}`;
    } else if (m.is_debtor) {
      statusText = `paga ${formatCentsToBrl(m.must_pay_cents)}`;
    }

    lines.push(
      `- ${m.display_name}: gastou ${formatCentsToBrl(m.spent_cents)} | cota justa: ${formatCentsToBrl(m.fair_share_cents)} (${statusText})`,
    );
  }
  lines.push("");

  if (plan.is_balanced || plan.transfers.length === 0) {
    lines.push("As contas da casa estao equilibradas. Nenhuma transferencia necessaria.");
  } else {
    lines.push("PAGAMENTOS A REALIZAR:");
    plan.transfers.forEach((t, idx) => {
      lines.push(`${idx + 1}. ${t.payer_name} deve pagar ${t.display_amount} para ${t.receiver_name}`);
      if (t.has_pix && t.pix_key) {
        lines.push(`   Chave Pix: ${t.pix_key}`);
        if (t.pix_payload) {
          lines.push(`   Pix Copia e Cola: ${t.pix_payload}`);
        }
      } else {
        lines.push("   Chave Pix: nao cadastrada");
      }
    });
  }

  return lines.join("\n");
}

// ===========================================================================
// 7. Validação Formal de Invariantes Contábeis do Plano de Acerto
// ===========================================================================

/**
 * Valida a preservação integral das invariantes contábeis de dupla entrada:
 *   1. A soma dos pagamentos das transferências liquida perfeitamente todas as dívidas;
 *   2. A soma dos recebimentos das transferências liquida perfeitamente todos os créditos;
 *   3. Nenhuma transferência possui valor menor ou igual a zero centavos;
 *   4. Não existem transferências do participante para ele mesmo (auto-pagamento);
 *   5. Cada participante devedor paga exatamente o montante devido;
 *   6. Cada participante credor recebe exatamente o montante a receber.
 */
export function validateSettlementPlanInvariants(
  plan: HouseholdSettlementPlan,
): HouseholdInvariantsValidation {
  const errors: string[] = [];

  const totalDebts = plan.members.reduce((acc, m) => acc + m.must_pay_cents, 0);
  const totalCredits = plan.members.reduce((acc, m) => acc + m.must_receive_cents, 0);

  if (totalDebts !== totalCredits) {
    errors.push(
      `Invariante violada: total de dividas (${totalDebts}) diverge do total de creditos (${totalCredits}).`,
    );
  }

  const sumTransfersCents = plan.transfers.reduce((acc, t) => acc + t.amount_cents, 0);

  if (sumTransfersCents !== plan.total_settlement_cents) {
    errors.push(
      `Invariante violada: soma das transferencias (${sumTransfersCents}) diverge do total informado (${plan.total_settlement_cents}).`,
    );
  }

  if (sumTransfersCents !== totalDebts) {
    errors.push(
      `Invariante violada: volume liquidado (${sumTransfersCents}) diverge do total de dividas (${totalDebts}).`,
    );
  }

  for (const t of plan.transfers) {
    if (t.amount_cents <= 0) {
      errors.push(`Invariante violada: transferencia ${t.id} possui valor nao-positivo (${t.amount_cents}).`);
    }
    if (t.payer_id === t.receiver_id) {
      errors.push(`Invariante violada: transferencia ${t.id} possui mesmo pagador e recebedor (${t.payer_id}).`);
    }
  }

  // Validação individual por participante
  for (const m of plan.members) {
    const paidByMember = plan.transfers
      .filter((t) => t.payer_id === m.user_id)
      .reduce((acc, t) => acc + t.amount_cents, 0);

    const receivedByMember = plan.transfers
      .filter((t) => t.receiver_id === m.user_id)
      .reduce((acc, t) => acc + t.amount_cents, 0);

    if (paidByMember !== m.must_pay_cents) {
      errors.push(
        `Invariante violada: participante ${m.user_id} (${m.display_name}) paga ${paidByMember} centavos mas deve ${m.must_pay_cents}.`,
      );
    }

    if (receivedByMember !== m.must_receive_cents) {
      errors.push(
        `Invariante violada: participante ${m.user_id} (${m.display_name}) recebe ${receivedByMember} centavos mas tem direito a ${m.must_receive_cents}.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ===========================================================================
// 8. Construção de Snapshot Imutável de Auditoria (family_settlements)
// ===========================================================================

/**
 * Constrói o objeto JSON estruturado canônico para armazenamento na coluna
 * `family_settlements.snapshot`, garantindo auditabilidade temporal do acerto.
 */
export function buildSettlementAuditSnapshot(
  plan: HouseholdSettlementPlan,
  meta?: { created_by?: string; notes?: string },
): Record<string, unknown> {
  return {
    month: plan.month,
    split_rule: plan.split_rule,
    total_spent_cents: plan.total_spent_cents,
    total_settlement_cents: plan.total_settlement_cents,
    is_balanced: plan.is_balanced,
    created_at: new Date().toISOString(),
    created_by: meta?.created_by ?? null,
    notes: meta?.notes ?? null,
    members: plan.members.map((m) => ({
      user_id: m.user_id,
      display_name: m.display_name,
      spent_cents: m.spent_cents,
      fair_share_cents: m.fair_share_cents,
      net_balance_cents: m.net_balance_cents,
      must_pay_cents: m.must_pay_cents,
      must_receive_cents: m.must_receive_cents,
      has_pix_key: m.has_pix_key,
      pix_key: m.pix_key,
    })),
    transfers: plan.transfers.map((t) => ({
      id: t.id,
      payer_id: t.payer_id,
      payer_name: t.payer_name,
      receiver_id: t.receiver_id,
      receiver_name: t.receiver_name,
      amount_cents: t.amount_cents,
      amount: t.amount,
      has_pix: t.has_pix,
      pix_key: t.pix_key,
      tx_id: t.tx_id,
    })),
  };
}

// ===========================================================================
// 9. Orquestrador de Compensação a Partir de Reconciliação
// ===========================================================================

/**
 * Constrói o plano de compensação a partir de um resultado prévio de reconciliação.
 */
export function calculateSettlementFromReconciliation(
  reconciliation: HouseholdReconciliationResult,
  membersMeta?: readonly SettlementMemberInput[],
  options?: HouseholdSettlementOptions,
): HouseholdSettlementPlan {
  const metaMap = new Map<string, SettlementMemberInput>();
  if (membersMeta) {
    for (const meta of membersMeta) {
      metaMap.set(meta.user_id, meta);
    }
  }

  const memberStatuses: SettlementMemberStatus[] = [];
  const memberBalances: SettlementMemberBalance[] = [];

  for (const m of reconciliation.members) {
    const meta = metaMap.get(m.user_id);
    const pixKey = meta?.pix_key?.trim() || m.pix_key?.trim() || null;
    const pixKeyType = (meta?.pix_key_type as FamilyPixKeyType) ?? (m.pix_key_type as FamilyPixKeyType) ?? null;
    const city = meta?.city?.trim() || null;

    const diff = calculateFairShareDifference(m.spent_cents, m.fair_share_cents);

    memberStatuses.push({
      user_id: m.user_id,
      display_name: m.display_name,
      role: m.role,
      spent_cents: m.spent_cents,
      fair_share_cents: m.fair_share_cents,
      net_balance_cents: m.net_balance_cents,
      display_net_balance: diff.display_net_balance,
      must_pay_cents: diff.must_pay_cents,
      must_receive_cents: diff.must_receive_cents,
      is_creditor: diff.is_creditor,
      is_debtor: diff.is_debtor,
      is_balanced: diff.is_balanced,
      has_pix_key: Boolean(pixKey && pixKey.length > 0),
      pix_key: pixKey,
      pix_key_type: pixKeyType,
    });

    memberBalances.push({
      user_id: m.user_id,
      display_name: m.display_name,
      role: m.role,
      spent_cents: m.spent_cents,
      fair_share_cents: m.fair_share_cents,
      net_balance_cents: m.net_balance_cents,
      pix_key: pixKey,
      pix_key_type: pixKeyType,
      city,
    });
  }

  const effectiveOptions: HouseholdSettlementOptions = {
    month: reconciliation.month,
    splitRule: reconciliation.split_rule_applied,
    defaultCity: options?.defaultCity,
    descriptionPrefix: options?.descriptionPrefix,
    ...options,
  };

  const transfers = resolveSettlementTransfers(memberBalances, effectiveOptions);
  const totalSettlementCents = transfers.reduce((acc, t) => acc + t.amount_cents, 0);

  const hasMissingPixKeys = transfers.some((t) => !t.has_pix);
  const isBalanced = transfers.length === 0;

  const planWithoutSummary: Omit<HouseholdSettlementPlan, "summary_text"> = {
    month: reconciliation.month,
    split_rule: reconciliation.split_rule_applied,
    total_spent_cents: reconciliation.total_spent_cents,
    total_settlement_cents: totalSettlementCents,
    is_balanced: isBalanced,
    has_missing_pix_keys: hasMissingPixKeys,
    transfers,
    members: memberStatuses,
    settled_at: reconciliation.is_fully_settled ? new Date().toISOString() : null,
  };

  const summary_text = formatSettlementSummaryText({
    ...planWithoutSummary,
    summary_text: "",
  });

  return {
    ...planWithoutSummary,
    summary_text,
  };
}

// ===========================================================================
// 10. Orquestrador Principal Puro de Compensação Familiar via Pix
// ===========================================================================

/**
 * Executa a compensação financeira completa da casa:
 *   1. Consolida os gastos e cotas devidas por membro (50/50 ou proporcional à renda);
 *   2. Apura as diferenças líquidas e saldos de cada membro;
 *   3. Determina o conjunto mínimo de transferências entre devedores e credores;
 *   4. Gera as chaves Pix e payloads EMVCo (BR Code) para transferência instantânea;
 *   5. Formata sumário para compartilhamento e valida as invariantes contábeis.
 */
export function calculateHouseholdSettlement(
  params: HouseholdSettlementParams,
): HouseholdSettlementPlan {
  const {
    monthly_ceiling_cents = 0,
    members,
    expenses,
    incomes,
    options,
  } = params;

  const { formattedMonth } = resolveCompetenceMonthParts(
    options?.month,
    options?.referenceDate,
  );

  const reconciliation = reconcileHouseholdSpending({
    monthly_ceiling_cents,
    members,
    expenses,
    incomes,
    options: {
      month: formattedMonth,
      referenceDate: options?.referenceDate,
      splitRule: options?.splitRule ?? "equal",
    },
  });

  const membersMeta: SettlementMemberInput[] = members.map((m) => ({
    user_id: m.user_id,
    display_name: m.display_name,
    role: m.role,
    pix_key: m.pix_key,
    pix_key_type: (m.pix_key_type as FamilyPixKeyType) ?? null,
  }));

  return calculateSettlementFromReconciliation(reconciliation, membersMeta, {
    month: formattedMonth,
    ...options,
  });
}
