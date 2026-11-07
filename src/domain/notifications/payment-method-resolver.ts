/**
 * Motor Puro de Desambiguação Universal de Métodos de Pagamento (§Plano 09 — Fase 3).
 *
 * Responsável por identificar e classificar com precisão absoluta o método de liquidação:
 * - Cartão de Crédito (credit_card)
 * - Cartão de Débito (debit)
 * - Pix (pix - enviado ou recebido)
 * - Transferência TED/DOC (transfer)
 * - Boleto, Concessionárias & Débito Automático (other)
 * - Saque em Espécie (cash)
 *
 * Função 100% pura: sem dependência de UI, React ou banco de dados.
 */

import type { PaymentMethod } from "@/types";

export interface PaymentMethodResolution {
  method: PaymentMethod;
  nature: "expense" | "income";
  suggestedCategorySlug?: string;
  subtype?: "cash_withdrawal" | "bill" | "concessionaire" | "own_deposit" | "digital_wallet" | "tax";
  label?: string;
}

const DIGITAL_WALLET_PACKAGES = new Set([
  "com.google.android.apps.walletnfcrel",
  "com.google.android.gms",
  "com.samsung.android.spay",
  "com.samsung.android.raja.spay",
  "com.samsung.android.app.spay",
]);

/**
 * Normaliza o texto removendo acentos e pontuação redundante para minúsculas.
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Identifica o método de pagamento e sua natureza financeira a partir dos tokens textuais.
 */
export function resolvePaymentMethod(
  text: string,
  title = "",
  packageName?: string,
): PaymentMethodResolution {
  const normText = normalizeText(text);
  const normTitle = normalizeText(title);
  const combined = `${normTitle} ${normText}`.trim();

  // =========================================================================
  // 1. SAQUE EM DINHEIRO / ESPÉCIE (cash)
  // =========================================================================
  const isCashWithdrawal =
    combined.includes("saque") ||
    combined.includes("retirada em caixa") ||
    combined.includes("terminal banco24horas") ||
    combined.includes("banco 24 horas") ||
    combined.includes("caixa eletronico") ||
    combined.includes("em especie");

  if (isCashWithdrawal) {
    return {
      method: "cash",
      nature: "expense",
      subtype: "cash_withdrawal",
      label: "Saque em Dinheiro",
      suggestedCategorySlug: "outros",
    };
  }

  // =========================================================================
  // 2. SINAIS INEGOCIÁVEIS DE RENDA / AUTO-DEPÓSITO / PROVENTOS
  //    (Trava de Precedência: "crédito em conta" NUNCA é cartão de crédito!)
  // =========================================================================
  const isAccountCreditIncome =
    combined.includes("credito em conta") ||
    combined.includes("creditado em conta") ||
    combined.includes("creditada em conta") ||
    combined.includes("creditado na sua conta") ||
    combined.includes("creditada na sua conta") ||
    combined.includes("credito na conta") ||
    combined.includes("estorno") ||
    combined.includes("reembolso") ||
    combined.includes("devolucao pix") ||
    combined.includes("pix devolvido") ||
    combined.includes("proventos") ||
    combined.includes("dividendos") ||
    combined.includes("salario") ||
    combined.includes("folha de pagamento");

  const isDepositOrIncomingTransfer =
    combined.includes("voce depositou") ||
    combined.includes("depositou") ||
    combined.includes("deposito via pix") ||
    combined.includes("deposito recebido") ||
    combined.includes("deposito em conta") ||
    combined.includes("adicionou dinheiro") ||
    combined.includes("dinheiro na conta") ||
    combined.includes("seu dinheiro ja esta disponivel") ||
    combined.includes("ja esta disponivel") ||
    combined.includes("dinheiro disponivel") ||
    combined.includes("saldo adicionado") ||
    combined.includes("pix recebido") ||
    combined.includes("recebeu um pix") ||
    combined.includes("recebeu pix") ||
    combined.includes("transferencia recebida") ||
    combined.includes("ted recebida") ||
    combined.includes("doc recebido");

  if (isAccountCreditIncome || isDepositOrIncomingTransfer) {
    const isTedDoc = combined.includes("ted") || combined.includes("doc");
    const isOwnDeposit =
      combined.includes("depositou") ||
      combined.includes("adicionou dinheiro") ||
      combined.includes("dinheiro na conta") ||
      combined.includes("ja esta disponivel");

    let suggestedCat = "outros";
    if (isOwnDeposit) {
      suggestedCat = "transferencias_recebidas";
    } else if (combined.includes("salario") || combined.includes("folha de pagamento")) {
      suggestedCat = "salario";
    } else if (combined.includes("provento") || combined.includes("dividendo")) {
      suggestedCat = "rendimentos";
    }

    return {
      method: isTedDoc ? "transfer" : "pix",
      nature: "income",
      subtype: isOwnDeposit ? "own_deposit" : undefined,
      suggestedCategorySlug: suggestedCat,
    };
  }

  // =========================================================================
  // 3. BOLETO, DÉBITO AUTOMÁTICO & CONCESSIONÁRIAS / TRIBUTOS (other)
  //    (Trava de Precedência: "débito automático" NUNCA é cartão de débito!)
  // =========================================================================
  const isConcessionaireOrUtility =
    combined.includes("debito automatico") ||
    combined.includes("debito em conta") ||
    combined.includes("conta de luz") ||
    combined.includes("conta de agua") ||
    combined.includes("conta de gas") ||
    combined.includes("enel") ||
    combined.includes("sabesp") ||
    combined.includes("comgas") ||
    combined.includes("claro") ||
    combined.includes("vivo") ||
    combined.includes("tim");

  const isBoletoOrTax =
    combined.includes("boleto") ||
    combined.includes("codigo de barras") ||
    combined.includes("tributo") ||
    combined.includes("ipva") ||
    combined.includes("iptu") ||
    combined.includes("darf") ||
    combined.includes("gps");

  if (isConcessionaireOrUtility || isBoletoOrTax) {
    const isTax = combined.includes("ipva") || combined.includes("iptu") || combined.includes("darf") || combined.includes("tributo");
    const isBill = combined.includes("boleto") || combined.includes("codigo de barras");
    return {
      method: "other",
      nature: "expense",
      subtype: isTax ? "tax" : isBill ? "bill" : "concessionaire",
      suggestedCategorySlug: "gastos_fixos",
    };
  }

  // =========================================================================
  // 4. CARTÃO DE CRÉDITO (credit_card)
  // =========================================================================
  const hasCreditCardSignals =
    combined.includes("no credito") ||
    combined.includes("credito a vista") ||
    combined.includes("compra no credito") ||
    combined.includes("cartao de credito") ||
    combined.includes("parcelado") ||
    /\b\d+x\b/.test(combined) ||
    combined.includes("infinite") ||
    combined.includes("black") ||
    combined.includes("platinum") ||
    combined.includes("itaucard") ||
    combined.includes("ourocard") ||
    combined.includes("cartao virtual") ||
    combined.includes("cartao nubank") ||
    combined.includes("bradesco cartoes") ||
    combined.includes("santander way") ||
    combined.includes("xp infinite") ||
    combined.includes("nomad infinite") ||
    /cartao final \d{4}/.test(combined) ||
    /[•*]{2,4}\s*\d{4}/.test(combined);

  const isDigitalWalletPackage = packageName ? DIGITAL_WALLET_PACKAGES.has(packageName) : false;
  const hasWalletTerms =
    combined.includes("google pay") ||
    combined.includes("google wallet") ||
    combined.includes("carteira google") ||
    combined.includes("samsung pay") ||
    combined.includes("samsung wallet");

  // Carteiras digitais em transações de compra sem menção de débito operam primariamente via Cartão de Crédito
  if (hasCreditCardSignals || ((isDigitalWalletPackage || hasWalletTerms) && !combined.includes("debito"))) {
    return {
      method: "credit_card",
      nature: "expense",
      subtype: isDigitalWalletPackage || hasWalletTerms ? "digital_wallet" : undefined,
    };
  }

  // =========================================================================
  // 5. CARTÃO DE DÉBITO (debit)
  // =========================================================================
  const hasDebitSignals =
    combined.includes("no debito") ||
    combined.includes("compra no debito") ||
    combined.includes("cartao de debito") ||
    combined.includes("debito a vista") ||
    (combined.includes("nomad") && combined.includes("purchase") && !combined.includes("credit")) ||
    (combined.includes("wise") && combined.includes("purchase") && !combined.includes("credit"));

  if (hasDebitSignals) {
    return {
      method: "debit",
      nature: "expense",
    };
  }

  // =========================================================================
  // 6. PIX ENVIADO / COMPRA PIX (pix)
  // =========================================================================
  const hasPixSignals =
    combined.includes("voce enviou um pix") ||
    combined.includes("pix enviado") ||
    combined.includes("pagamento via pix") ||
    combined.includes("copia e cola") ||
    combined.includes("qr code pix") ||
    combined.includes("voce pagou com pix") ||
    combined.includes("chave pix") ||
    combined.includes("pix de r$") ||
    combined.includes("pix para");

  if (hasPixSignals) {
    return {
      method: "pix",
      nature: "expense",
    };
  }

  // =========================================================================
  // 7. TRANSFERÊNCIA TED / DOC (transfer)
  // =========================================================================
  const hasTransferSignals =
    combined.includes("ted") ||
    combined.includes("doc") ||
    combined.includes("transferencia enviada") ||
    combined.includes("transferencia realizada") ||
    combined.includes("transferencia para");

  if (hasTransferSignals) {
    return {
      method: "transfer",
      nature: "expense",
    };
  }

  // =========================================================================
  // 8. FALLBACK BASEADO EM CONTEXTO DE APPS E TERMOS COMUNS
  // =========================================================================
  if (combined.includes("cartao") || combined.includes("aprovada") || combined.includes("aprovado")) {
    return {
      method: "credit_card",
      nature: "expense",
    };
  }

  if (combined.includes("saldo da conta") || combined.includes("saldo de conta")) {
    return {
      method: "other",
      nature: "expense",
    };
  }

  return {
    method: "other",
    nature: "expense",
  };
}
