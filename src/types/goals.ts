/**
 * Contratos de Composição Patrimonial de Metas Financeiras (§Plano 12).
 *
 * Suporta metas integradas ao patrimônio (Saldo em Contas Correntes + Investimentos na Custódia),
 * decomposição visual entre aportes realizados e rendimentos de mercado, e prevenção de double counting
 * por teto exclusivo de alocação.
 */

export const MAX_ACTIVE_GOALS = 5;

export type GoalSourceMode = "manual" | "patrimonial";

export type GoalInvestmentSelectionMode =
  | "selected_assets"
  | "selected_classes"
  | "entire_portfolio";

export interface GoalCompositionConfig {
  /** Se considera saldo em contas bancárias / caixa real. */
  includeCheckingAccounts: boolean;
  /** IDs das contas específicas selecionadas. Se vazio/null e includeCheckingAccounts = true, considera todas. */
  accountIds?: string[] | null;
  /** Se considera ativos da carteira de investimentos. */
  includeInvestments: boolean;
  /** Modo de seleção de investimentos. */
  investmentMode: GoalInvestmentSelectionMode;
  /** IDs dos ativos específicos da custódia. */
  assetIds?: string[] | null;
  /** Classes de ativos selecionadas (ex.: "Renda Fixa", "Tesouro Direto", "Ações"). */
  classes?: string[] | null;
  /** Teto máximo em centavos alocado para esta meta (prevenção de double counting com outras metas). */
  allocationCapCents?: number | null;
  /** Trava de meta conquistada (impede que volatilidade de mercado recue a barra após 100%). */
  isCompletedLocked?: boolean;
}

export interface GoalCompositionResult {
  /** Valor acumulado final efetivo em centavos (limitado ao allocationCap se houver). */
  currentCents: number;
  /** Valor bruto total apurado antes da aplicação de teto. */
  grossAvailableCents: number;
  /** Meta alvo em centavos. */
  targetCents: number;
  /** Percentual atingido (0 a 100+). */
  progressPercent: number;
  /** Se atingiu 100% ou mais da meta. */
  isReached: boolean;
  /** Parcela originada de saldos em conta bancária (após dedução de obrigações imediatas). */
  checkingAccountsCents: number;
  /** Parcela originada de investimentos em custódia. */
  investmentsCents: number;
  /** Total desembolsado em dinheiro/aportes históricos na composição. */
  totalDesembolsadoCents: number;
  /** Rendimentos e valorização acumulados pelo efeito dos juros compostos. */
  totalRendimentosCents: number;
  /** Se o teto de alocação anti-double counting reduziu o saldo computado. */
  isCapApplied: boolean;
  /** Avisos informativos (ex.: conta compartilhada, volatilidade de mercado). */
  warnings: string[];
}
