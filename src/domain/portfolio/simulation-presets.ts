/**
 * Presets de estratégias de alocação de carteira e rebalanceamento.
 * Fonte única compartilhada entre a Landing Page e a ferramenta pública /ferramentas/rebalanceamento.
 * AGENTS.md §3 (funções e constantes puras de domínio).
 */

import type { StrategyClassItem } from "./simulation";

export type StrategyPresetKey = "dividendos" | "multimercado" | "crescimento";

export interface StrategyPresetConfig {
  id: StrategyPresetKey;
  label: string;
  name: string;
  buttonLabel: string;
  tag: string;
  description: string;
  classes: StrategyClassItem[];
}

export const STRATEGY_PRESETS: Record<StrategyPresetKey, StrategyPresetConfig> = {
  dividendos: {
    id: "dividendos",
    label: "Foco em Proventos & Dividendos",
    name: "Foco em Proventos & Dividendos",
    buttonLabel: "Dividendos",
    tag: "Geração de Renda",
    description: "Prioridade para proventos mensais recorrentes com Fundos Imobiliários e Ações de dividendos.",
    classes: [
      { key: "fiis", name: "Fundos Imobiliários", targetPercent: 40, currentProportion: 0.28, yieldRate: 0.10 },
      { key: "acoes", name: "Ações de Dividendos", targetPercent: 30, currentProportion: 0.23, yieldRate: 0.085 },
      { key: "rf", name: "Renda Fixa CDI", targetPercent: 20, currentProportion: 0.37, yieldRate: 0.06 },
      { key: "global", name: "REITs Globais", targetPercent: 10, currentProportion: 0.12, yieldRate: 0.05 },
    ],
  },
  multimercado: {
    id: "multimercado",
    label: "Multi-Mercado Global",
    name: "Global Multi-Mercado",
    buttonLabel: "Global",
    tag: "Diversificação Ampla",
    description: "Equilíbrio entre Bolsa Brasil, Renda Fixa e Exposição Internacional em Dólar.",
    classes: [
      { key: "global", name: "Ativos Globais / Dólar", targetPercent: 25, currentProportion: 0.15, yieldRate: 0.035 },
      { key: "fiis", name: "Fundos Imobiliários", targetPercent: 20, currentProportion: 0.14, yieldRate: 0.095 },
      { key: "acoes", name: "Ações Brasil", targetPercent: 25, currentProportion: 0.29, yieldRate: 0.07 },
      { key: "rf", name: "Renda Fixa IPCA+", targetPercent: 30, currentProportion: 0.42, yieldRate: 0.065 },
    ],
  },
  crescimento: {
    id: "crescimento",
    label: "Crescimento & Ações",
    name: "Crescimento & Longo Prazo",
    buttonLabel: "Crescimento",
    tag: "Multiplicação de Capital",
    description: "Maior exposição à valorização de empresas e tecnologia com horizonte de longo prazo.",
    classes: [
      { key: "acoes", name: "Ações Brasil Growth", targetPercent: 40, currentProportion: 0.26, yieldRate: 0.045 },
      { key: "global", name: "Tech Global / Nasdaq", targetPercent: 30, currentProportion: 0.20, yieldRate: 0.02 },
      { key: "fiis", name: "FIIs de Tijolo", targetPercent: 15, currentProportion: 0.21, yieldRate: 0.085 },
      { key: "rf", name: "Reserva de Oportunidade", targetPercent: 15, currentProportion: 0.33, yieldRate: 0.06 },
    ],
  },
};

export const STRATEGY_PRESETS_LIST: readonly StrategyPresetConfig[] = Object.freeze([
  STRATEGY_PRESETS.dividendos,
  STRATEGY_PRESETS.multimercado,
  STRATEGY_PRESETS.crescimento,
]);
