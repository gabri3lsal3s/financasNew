/**
 * Utilitários centrais de formatação de apresentação (camada de serviços).
 *
 * Consolida a formatação pt-BR de quantidades de ativos financeiros conforme
 * a natureza da classe (ações/FIIs inteiros e fracionários, renda fixa/tesouro,
 * internacional e criptoativos de alta precisão).
 */

function resolveMaxFractionDigits(qty: number, assetClass?: string): number {
  const normalized = (assetClass ?? "").trim().toLowerCase();

  if (
    normalized.includes("cripto") ||
    normalized.includes("crypto") ||
    normalized.includes("bitcoin") ||
    normalized === "btc" ||
    normalized === "eth"
  ) {
    return 8;
  }

  if (
    normalized.includes("internacional") ||
    normalized.includes("global") ||
    normalized.includes("exterior") ||
    normalized.includes("renda fixa") ||
    normalized.includes("tesouro") ||
    normalized.includes("etf") ||
    normalized.includes("reit") ||
    normalized.includes("bdr")
  ) {
    return 6;
  }

  if (
    normalized.includes("ação") ||
    normalized.includes("acoes") ||
    normalized.includes("ações") ||
    normalized.includes("acao") ||
    normalized.includes("fii") ||
    normalized.includes("imobili")
  ) {
    return Math.abs(qty) < 0.0001 ? 6 : 4;
  }

  if (Math.abs(qty) < 0.0001) return 8;
  if (Math.abs(qty) < 0.01) return 6;
  return 4;
}

/**
 * Formata a quantidade de cotas/unidades de um ativo em padrão pt-BR,
 * exibindo inteiros sem casas decimais e preservando precisão fracionária
 * adequada à classe do ativo (até 8 casas em cripto, 6 em internacional/RF, 4 em ações/FIIs).
 */
export function formatAssetQuantity(qty: number, assetClass?: string): string {
  if (!Number.isFinite(qty) || Math.abs(qty) < 1e-10) {
    return "0";
  }

  const roundedInt = Math.round(qty);
  if (Math.abs(qty - roundedInt) < 1e-9) {
    const safeInt = Object.is(roundedInt, -0) ? 0 : roundedInt;
    return safeInt.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  const maxDigits = resolveMaxFractionDigits(qty, assetClass);
  return qty.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
}
