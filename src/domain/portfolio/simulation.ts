/**
 * Motor puro de simulação de rebalanceamento por classes e projeção de renda passiva.
 * Utilizado pelo simulador público interativo da landing page e projeções macro.
 * Cálculos 100% determinísticos sem efeitos colaterais (AGENTS.md §3).
 */

export interface StrategyClassItem {
  key: string;
  name: string;
  /** Proporção atual da classe na carteira (0 a 1). */
  currentProportion: number;
  /** Meta percentual da classe na estratégia (0 a 100). */
  targetPercent: number;
  /** Taxa anual estimada de dividend yield (0 a 1). */
  yieldRate: number;
}

export interface StrategySimulationInput {
  patrimonyBase: number;
  aporteAmount: number;
  classes: readonly StrategyClassItem[];
}

export interface StrategyClassAllocationResult extends StrategyClassItem {
  currentValue: number;
  targetValue: number;
  deficit: number;
  allocatedAmount: number;
  finalValue: number;
  currentPct: number;
  finalPct: number;
  isReceivingAporte: boolean;
}

export interface StrategySimulationResult {
  newTotalPatrimony: number;
  allocations: StrategyClassAllocationResult[];
  annualDividends: number;
  monthlyPassive: number;
}

/**
 * Simula a alocação de um aporte entre classes de ativos para aproximar das metas percentuais.
 * Distribui proporcionalmente ao déficit de cada classe e ajusta centavos no maior aporte.
 */
export function simulateStrategyAporte(input: StrategySimulationInput): StrategySimulationResult {
  const patrimonyBase = Math.max(0, input.patrimonyBase);
  const aporteAmount = Math.max(0, input.aporteAmount);
  const newTotalPatrimony = patrimonyBase + aporteAmount;

  if (input.classes.length === 0) {
    return {
      newTotalPatrimony,
      allocations: [],
      annualDividends: 0,
      monthlyPassive: 0,
    };
  }

  // 1. Valores atuais e ideais
  const initialData = input.classes.map((cls) => {
    const currentValue = patrimonyBase * cls.currentProportion;
    const targetValue = newTotalPatrimony * (cls.targetPercent / 100);
    const deficit = Math.max(0, targetValue - currentValue);
    return {
      ...cls,
      currentValue,
      targetValue,
      deficit,
    };
  });

  const totalDeficit = initialData.reduce((sum, cls) => sum + cls.deficit, 0);

  // 2. Alocação proporcional ao déficit
  const allocations: StrategyClassAllocationResult[] = initialData.map((cls) => {
    let allocated = 0;
    if (totalDeficit > 0 && cls.deficit > 0) {
      allocated = Math.round((cls.deficit / totalDeficit) * aporteAmount);
    }
    const finalValue = cls.currentValue + allocated;
    const currentPct = patrimonyBase > 0 ? Math.round((cls.currentValue / patrimonyBase) * 100) : 0;
    const finalPct = newTotalPatrimony > 0 ? Math.round((finalValue / newTotalPatrimony) * 100) : 0;

    return {
      ...cls,
      allocatedAmount: allocated,
      finalValue,
      currentPct,
      finalPct,
      isReceivingAporte: allocated > 0,
    };
  });

  // 3. Ajuste de resíduo de arredondamento no maior aporte
  const allocatedSum = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const diff = aporteAmount - allocatedSum;
  if (diff !== 0 && allocations.length > 0) {
    const highest = allocations.reduce((prev, curr) =>
      curr.allocatedAmount > prev.allocatedAmount ? curr : prev,
    );
    highest.allocatedAmount += diff;
    highest.finalValue += diff;
    if (newTotalPatrimony > 0) {
      highest.finalPct = Math.round((highest.finalValue / newTotalPatrimony) * 100);
    }
  }

  // 4. Estimativa de dividendos anuais e renda passiva mensal
  const annualDividends = allocations.reduce((sum, cls) => sum + cls.finalValue * cls.yieldRate, 0);
  const monthlyPassive = Math.round(annualDividends / 12);

  return {
    newTotalPatrimony,
    allocations,
    annualDividends,
    monthlyPassive,
  };
}
