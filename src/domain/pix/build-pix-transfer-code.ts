/**
 * Builder puro de payload Pix Copia e Cola (BR Code EMV).
 *
 * Centraliza a sanitização de nome/cidade/TXID/descrição adicional, detecção automática
 * do tipo de chave Pix e validação de integridade CRC16 para todos os fluxos do Axir
 * (Metas Coletivas, Racha de Despesas, Acerto de Viagem e Acerto Familiar).
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import {
  detectPixKeyType,
  generatePixBrCode,
  sanitizeMerchantText,
  sanitizeTxId,
  validatePixBrCode,
  type PixKeyType,
} from "./pix-br-code";

export interface BuildPixTransferCodeOptions {
  /** Chave Pix do recebedor (se vazia, nula ou inválida, retorna null). */
  pixKey: string | null | undefined;
  /** Tipo explícito da chave ("auto" e "unknown" acionam detecção automática). */
  keyType?: PixKeyType | "auto" | "unknown" | null;
  /** Nome do recebedor (ID 59 — sanitizado e truncado até 25 caracteres). */
  merchantName?: string | null;
  /** Cidade do recebedor (ID 60 — sanitizada em maiúsculas até 15 caracteres). */
  merchantCity?: string | null;
  /** Valor em centavos (inteiro >= 0; 0 ou omitido gera Pix com valor em aberto). */
  amountCents?: number | null;
  /** Identificador da transação (ID 62.05 — alfanumérico até 25 chars ou "***"). */
  txId?: string | null;
  /** Informação adicional (ID 26.02 — sanitizada até 25 caracteres). */
  infoAdicional?: string | null;
  /** CEP do recebedor (ID 61 — opcional). */
  postalCode?: string | null;
  /** Fallback para nome do recebedor quando vazio após sanitização. */
  defaultMerchantName?: string;
  /** Fallback para cidade do recebedor quando vazia após sanitização. */
  defaultMerchantCity?: string;
}

/**
 * Resolve o tipo efetivo da chave Pix considerando valores especiais "auto" e "unknown".
 */
export function resolvePixKeyType(
  pixKey: string,
  explicitType?: PixKeyType | "auto" | "unknown" | null,
): PixKeyType | undefined {
  if (explicitType && explicitType !== "auto" && explicitType !== "unknown") {
    return explicitType;
  }
  const detected = detectPixKeyType(pixKey);
  return detected === "unknown" ? undefined : detected;
}

/**
 * Monta e valida uma string Pix Copia e Cola (BR Code EMV) de forma resiliente.
 * Retorna `null` caso a chave seja ausente/inválida, o valor seja inválido ou o
 * payload não passe na verificação de CRC16.
 */
export function buildPixTransferCode(options: BuildPixTransferCodeOptions): string | null {
  if (!options || typeof options.pixKey !== "string") {
    return null;
  }

  const trimmedKey = options.pixKey.trim();
  if (!trimmedKey) {
    return null;
  }

  if (options.amountCents !== undefined && options.amountCents !== null) {
    if (!Number.isInteger(options.amountCents) || options.amountCents < 0) {
      return null;
    }
  }

  const fallbackName =
    sanitizeMerchantText(options.defaultMerchantName ?? "Recebedor", 25) || "Recebedor";
  const fallbackCity =
    sanitizeMerchantText(options.defaultMerchantCity ?? "BRASIL", 15, true) || "BRASIL";

  const cleanMerchantName =
    sanitizeMerchantText(options.merchantName ?? "", 25) || fallbackName;
  const cleanMerchantCity =
    sanitizeMerchantText(options.merchantCity ?? "", 15, true) || fallbackCity;

  const cleanInfo = options.infoAdicional
    ? sanitizeMerchantText(options.infoAdicional, 25) || undefined
    : undefined;
  const cleanTxId = options.txId ? sanitizeTxId(options.txId) : undefined;
  const resolvedKeyType = resolvePixKeyType(trimmedKey, options.keyType);

  try {
    const payload = generatePixBrCode({
      pixKey: trimmedKey,
      keyType: resolvedKeyType,
      merchantName: cleanMerchantName,
      merchantCity: cleanMerchantCity,
      amountCents: options.amountCents ?? undefined,
      txId: cleanTxId,
      infoAdicional: cleanInfo,
      postalCode: options.postalCode ?? undefined,
    });

    return validatePixBrCode(payload) ? payload : null;
  } catch {
    return null;
  }
}
