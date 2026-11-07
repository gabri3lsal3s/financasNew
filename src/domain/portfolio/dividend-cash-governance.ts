/**
 * Governança Contábil de Liquidação de Proventos e Estorno Seguro no Caixa.
 *
 * Protege contra inconsistências contábeis de Caixa causadas por:
 *  1. Liquidação prematura antes da data efetiva de pagamento na corretora;
 *  2. Estornos (Undo/Exclusão) de proventos que já foram total ou parcialmente reinvestidos.
 *
 * Módulo puro — sem chamadas externas.
 */

export interface CashReversalSafeguardResult {
  isSafe: boolean;
  cashBalance: number;
  reversalAmount: number;
  newBalance: number;
  shortfall: number;
  warningMessage?: string;
}

/**
 * Valida se uma data de provento já atingiu a liquidação financeira na corretora.
 */
export function isDividendLiquidationDue(
  paymentDate: string,
  referenceDate: string = new Date().toISOString().slice(0, 10),
): boolean {
  return paymentDate.slice(0, 10) <= referenceDate.slice(0, 10);
}

/**
 * Avalia o impacto de um estorno no ativo Caixa e alerta caso os fundos já tenham sido reinvestidos.
 *
 * @param cashAssetBalance Saldo atual em unidades (R$) do ativo CAIXA
 * @param reversalAmount Montante financeiro do provento a ser estornado
 */
export function validateDividendReversalSafeguard(
  cashAssetBalance: number,
  reversalAmount: number,
): CashReversalSafeguardResult {
  const currentBalance = Math.max(0, cashAssetBalance);
  const targetReversal = Math.max(0, reversalAmount);

  const shortfall = Math.max(0, Math.round((targetReversal - currentBalance) * 100) / 100);
  const isSafe = shortfall <= 0;
  const newBalance = Math.max(0, Math.round((currentBalance - targetReversal) * 100) / 100);

  let warningMessage: string | undefined;
  if (!isSafe) {
    warningMessage =
      `O saldo atual de Caixa (R$ ${currentBalance.toFixed(2)}) é menor que o estorno (R$ ${targetReversal.toFixed(2)}). ` +
      `O saldo restante de Caixa ficará zerado e a diferença (R$ ${shortfall.toFixed(2)}) indica que o recurso já foi reinvestido.`;
  }

  return {
    isSafe,
    cashBalance: currentBalance,
    reversalAmount: targetReversal,
    newBalance,
    shortfall,
    warningMessage,
  };
}
