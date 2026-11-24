/**
 * Motor puro de detecção de conflitos de escopo e prevenção de confusão patrimonial (PF × PJ).
 *
 * Analisa a coerência entre:
 *  1. Escopo pretendido da transação (`personal` vs `business`)
 *  2. Escopo do meio de pagamento / cartão (`personal`, `business`, `mixed`)
 *  3. Natureza semântica da despesa (despesas domésticas em conta PJ)
 */

import type { CreditCardScope, TransactionScope } from "@/types";

export type ScopeConflictKind =
  | "none"
  | "personal_on_business_card"
  | "business_on_personal_card"
  | "domestic_expense_in_business_scope";

export interface ScopeConflictCheckResult {
  hasConflict: boolean;
  conflictKind: ScopeConflictKind;
  warningMessage?: string;
  suggestedAction?: "switch_to_personal" | "request_reimbursement" | "record_as_pro_labore";
}

const STRICT_DOMESTIC_KEYWORDS = [
  "supermercado",
  "padaria",
  "sacolao",
  "acougue",
  "cinema",
  "cinemark",
  "netflix",
  "disney",
  "spotify",
  "brinquedo",
  "farmacia",
  "drogaria",
  "pet shop",
  "escola infantil",
] as const;

function normalize(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectScopeConflict(params: {
  transactionScope: TransactionScope;
  cardScope?: CreditCardScope | null;
  description?: string | null;
  categoryName?: string | null;
}): ScopeConflictCheckResult {
  const { transactionScope, cardScope, description, categoryName } = params;

  // 1. Despesa lançada em escopo de negócio em cartão estritamente pessoal
  if (transactionScope === "business" && cardScope === "personal") {
    return {
      hasConflict: true,
      conflictKind: "business_on_personal_card",
      warningMessage:
        "Despesa do negócio realizada com cartão pessoal. O valor pode ser reembolsado da PJ para a PF.",
      suggestedAction: "request_reimbursement",
    };
  }

  // 2. Despesa lançada em escopo pessoal em cartão estritamente de negócio
  if (transactionScope === "personal" && cardScope === "business") {
    return {
      hasConflict: true,
      conflictKind: "personal_on_business_card",
      warningMessage:
        "Despesa pessoal realizada no cartão corporativo da empresa. Recomenda-se registrar como retirada / pró-labore ou reembolsar a PJ.",
      suggestedAction: "record_as_pro_labore",
    };
  }

  // 3. Despesa com padrão doméstico flagrante lançada dentro do escopo de negócio
  if (transactionScope === "business") {
    const combined = `${normalize(description)} ${normalize(categoryName)}`.trim();
    for (const term of STRICT_DOMESTIC_KEYWORDS) {
      if (combined.includes(term)) {
        return {
          hasConflict: true,
          conflictKind: "domestic_expense_in_business_scope",
          warningMessage: `Despesa com características de consumo doméstico/pessoal (${term}) no escopo da empresa.`,
          suggestedAction: "switch_to_personal",
        };
      }
    }
  }

  return {
    hasConflict: false,
    conflictKind: "none",
  };
}
