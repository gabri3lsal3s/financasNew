/**
 * Critérios polimórficos e metadados de avaliação de tese & nota (0–10) — §3.11.1.
 * Módulo puro compartilhado entre StepGovernance (Wizard) e AssetScoreEvaluationDialog (Regra DRY §4).
 */

import type { AssetAllocationStatus } from "@/types";
import { normalizeClassName } from "./valuation";

export interface ScoreCriterionConfig {
  key: string;
  label: string;
  description: string;
}

export type ScoreArchetypeKey = "acoes" | "fiis" | "renda_fixa" | "cripto" | "default";

export const CRITERIA_BY_ARCHETYPE: Record<ScoreArchetypeKey, readonly ScoreCriterionConfig[]> = {
  acoes: [
    { key: "governance", label: "Governança & Alinhamento", description: "Novo Mercado, tag along 100%, controle societário transparente" },
    { key: "roic", label: "Rentabilidade & ROIC", description: "ROIC e ROE consistentemente acima do custo de capital" },
    { key: "moat", label: "Vantagens Competitivas", description: "Barreiras de entrada fortes, poder de precificação e escala" },
    { key: "debt", label: "Saúde Financeira", description: "Dívida líquida / EBITDA saudável e fluxo de caixa livre previsível" },
  ],
  fiis: [
    { key: "location", label: "Qualidade dos Imóveis", description: "Ativos bem localizados (regiões prime / AAA) e bom estado" },
    { key: "vacancy", label: "Ocupação & Inadimplência", description: "Baixo histórico de vacância física/financeira e contratos atípicos" },
    { key: "management", label: "Qualidade da Gestão", description: "Gestora experiente, alinhamento de taxas e transparência" },
    { key: "yield_sustainability", label: "Sustentabilidade do Yield", description: "Rendimentos consistentes sem depender de reservas pontuais" },
  ],
  renda_fixa: [
    { key: "credit_risk", label: "Risco de Crédito", description: "Solidez do emissor (Rating AAA/AA) ou cobertura pelo FGC" },
    { key: "liquidity", label: "Liquidez & Prazo", description: "Prazo condizente com os objetivos e carência respeitada" },
    { key: "index_alignment", label: "Taxa & Indexador", description: "Taxa real atrativa frente à inflação ou juros futuros" },
  ],
  cripto: [
    { key: "decentralization", label: "Descentralização & Segurança", description: "Rede robusta, sem ponto único de falha e código auditado" },
    { key: "adoption", label: "Efeito de Rede & Liquidez", description: "Adoção institucional crescente e alta liquidez global" },
    { key: "tokenomics", label: "Tokenomics", description: "Escassez programada, emissão controlada e utilidade clara" },
  ],
  default: [
    { key: "conviction", label: "Convicção Estratégica", description: "Entendimento profundo da tese e dos riscos envolvidos" },
    { key: "risk_reward", label: "Relação Risco-Retorno", description: "Assimetria favorável e potencial de valorização comprovado" },
  ],
};

export function getScoreArchetypeKey(assetClass?: string | null): ScoreArchetypeKey {
  if (!assetClass) return "default";
  const norm = normalizeClassName(assetClass);
  if (norm.includes("acao") || norm.includes("acoes") || norm.includes("stock")) return "acoes";
  if (norm.includes("fii") || norm.includes("imobiliario") || norm.includes("reit")) return "fiis";
  if (norm.includes("fixa") || norm.includes("tesouro") || norm.includes("cdb")) return "renda_fixa";
  if (norm.includes("cripto") || norm.includes("crypto") || norm.includes("bitcoin")) return "cripto";
  return "default";
}

export const REVIEW_FREQUENCY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "3", label: "Trimestral (3 meses)" },
  { value: "6", label: "Semestral (6 meses - recomendado)" },
  { value: "12", label: "Anual (12 meses)" },
];

export interface ScoreConvictionMeta {
  label: string;
  tone: "positive" | "warning" | "critical" | "muted";
  badgeVariant: "positive" | "muted" | "negative";
}

export function getScoreConvictionMeta(score: number | null | undefined): ScoreConvictionMeta {
  if (score == null) {
    return {
      label: "Sem nota (peso neutro 5)",
      tone: "muted",
      badgeVariant: "muted",
    };
  }
  if (score >= 8) {
    return {
      label: "Alta Convicção",
      tone: "positive",
      badgeVariant: "positive",
    };
  }
  if (score >= 7) {
    return {
      label: "Boa Convicção",
      tone: "positive",
      badgeVariant: "positive",
    };
  }
  if (score >= 6) {
    return {
      label: "Média Convicção",
      tone: "warning",
      badgeVariant: "muted",
    };
  }
  if (score >= 4) {
    return {
      label: "Neutro / Regular",
      tone: "warning",
      badgeVariant: "muted",
    };
  }
  return {
    label: "Baixa Convicção",
    tone: "critical",
    badgeVariant: "negative",
  };
}

export const ALLOCATION_STATUS_META: Record<
  AssetAllocationStatus,
  { label: string; shortLabel: string; description: string; badgeVariant: "positive" | "muted" | "negative" }
> = {
  active: {
    label: "Aportar",
    shortLabel: "Ativo",
    description: "Recebe aportes normalmente conforme Nota",
    badgeVariant: "positive",
  },
  neutral: {
    label: "Neutro",
    shortLabel: "Neutro",
    description: "Mantido em carteira, sem novos aportes",
    badgeVariant: "muted",
  },
  quarantine: {
    label: "Quarentena",
    shortLabel: "Quarentena",
    description: "Aportes bloqueados para análise de tese",
    badgeVariant: "muted",
  },
  exit: {
    label: "Saída",
    shortLabel: "Saída",
    description: "Desinvestimento programado (meta 0%)",
    badgeVariant: "negative",
  },
};
