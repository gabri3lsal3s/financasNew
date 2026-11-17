export type FundingSource = "pocket" | "cash";

export interface FundingSourceFlags {
  syncCash: boolean;
  recordContribution: boolean;
}

/**
 * Converte flags booleanas legadas para a origem mutuamente exclusiva.
 */
export function fundingSourceFromFlags(syncCash: boolean, recordContribution: boolean): FundingSource {
  if (syncCash && !recordContribution) return "cash";
  return "pocket";
}

/**
 * Converte a origem selecionada para os flags esperados pelas mutações de carteira.
 */
export function flagsFromFundingSource(source: FundingSource): FundingSourceFlags {
  if (source === "cash") {
    return { syncCash: true, recordContribution: false };
  }
  return { syncCash: false, recordContribution: true };
}
