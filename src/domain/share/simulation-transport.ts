/**
 * Motor de transporte de dados de simulação (simulation-transport.ts).
 *
 * Permite serializar e armazenar simulações financeiras abertas executadas nos
 * simuladores públicos (/ferramentas/*) para transferência automática e
 * provisionamento na conta do usuário pós-cadastro (auto-onboarding).
 *
 * 100% Pura, sem dependência de UI ou Supabase.
 */

export interface PendingDebtSimulation {
  type: "debt_simulator";
  debts: Array<{
    name: string;
    balanceCents: number;
    interestRateAnnual: number;
    minimumPaymentCents: number;
  }>;
  extraMonthlyCents?: number;
  strategy?: "avalanche" | "snowball";
}

export interface PendingRebalanceSimulation {
  type: "rebalance_simulator";
  classes: Array<{
    name: string;
    targetPercent: number;
  }>;
  patrimonyBaseCents?: number;
  aporteAmountCents?: number;
  selectedPreset?: string;
}

export interface PendingCompoundInterestSimulation {
  type: "compound_interest";
  initialAmountCents: number;
  monthlyContributionCents: number;
  annualRatePercent: number;
  periodYears: number;
  monthlyLivingCostCents?: number;
}

export type PendingSimulation =
  | PendingDebtSimulation
  | PendingRebalanceSimulation
  | PendingCompoundInterestSimulation;

export const PENDING_SIMULATION_STORAGE_KEY = "axis_pending_simulation_data";

/**
 * Armazena a simulação pendente em storage local para recuperação no onboarding.
 */
export function storePendingSimulation(simulation: PendingSimulation): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      PENDING_SIMULATION_STORAGE_KEY,
      JSON.stringify(simulation),
    );
  } catch {
    // Falha silenciosa em ambientes com armazenamento restrito
  }
}

/**
 * Recupera e valida a simulação pendente salva em storage.
 */
export function getPendingSimulation(): PendingSimulation | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PENDING_SIMULATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return null;
    }

    const type = (parsed as { type: unknown }).type;
    if (
      type === "debt_simulator" ||
      type === "rebalance_simulator" ||
      type === "compound_interest"
    ) {
      return parsed as PendingSimulation;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Remove a simulação pendente do storage após o processamento bem-sucedido.
 */
export function clearPendingSimulation(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(PENDING_SIMULATION_STORAGE_KEY);
  } catch {
    // ignora falha de remoção
  }
}

/**
 * Constrói a URL do fluxo de cadastro com indicação de origem do simulador.
 */
export function buildSimulationRegisterUrl(simulation?: PendingSimulation): string {
  if (!simulation) {
    return "/cadastro";
  }

  const params = new URLSearchParams();
  params.set("from", "simulador");
  params.set("tipo", simulation.type);

  return `/cadastro?${params.toString()}`;
}
