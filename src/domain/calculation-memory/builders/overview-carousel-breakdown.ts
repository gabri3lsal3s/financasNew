/**
 * Builders puros de Memória de Cálculo para Metas e Rachas do Carrossel da Home (Fase 2B).
 */

import { formatDateBR } from "@/lib/date";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

export interface GoalEvidence {
  shareId: string;
  goalTitle?: string;
  asOf: string;
  deadline: string | null;
  targetCents: number;
  currentCents: number;
  source: string;
  remainingCents: number;
  remainingDays: number | null;
  requiredDailyCents: number | null;
  stage: "completed" | "final_stretch" | "has_surplus" | "regular";
}

export function buildGoalProgressBreakdown(e: GoalEvidence): CalculationBreakdown {
  const isCompleted = e.remainingCents <= 0 && e.targetCents > 0;
  const steps: BreakdownStep[] = [
    {
      label: "Valor Alvo da Meta",
      operator: "=",
      rawValue: e.targetCents,
      unit: "currency",
    },
    {
      label: `Acumulado Atual (${e.source})`,
      operator: "-",
      rawValue: e.currentCents,
      unit: "currency",
      tone: "positive",
    },
    {
      label: isCompleted ? "Meta Concluída" : "Valor Faltante",
      operator: "=",
      rawValue: e.remainingCents,
      unit: "currency",
      tone: isCompleted ? "positive" : "default",
      emphasis: "subtotal",
    },
  ];

  if (e.remainingDays !== null && e.remainingDays > 0 && e.requiredDailyCents !== null) {
    steps.push({
      label: `Ritmo Diário Necessário (${e.remainingDays} dias restantes)`,
      operator: "=",
      rawValue: e.requiredDailyCents,
      unit: "currency",
      tone: "portfolio",
    });
  }

  return enrichBreakdown({
    id: `goal-progress-${e.shareId}`,
    title: e.goalTitle ? `Meta: ${e.goalTitle}` : "Progresso da Meta",
    description: "Calcula o saldo faltante em centavos e, quando há prazo definido, o ritmo diário necessário.",
    periodLabel: e.deadline ? `Prazo até ${formatDateBR(e.deadline)}` : `Posição em ${formatDateBR(e.asOf)}`,
    formulaExpression: "Faltante = max(0, Alvo - Atual) · Ritmo = ceil(Faltante / Dias Restantes)",
    unit: "currency",
    steps,
    result: {
      label: isCompleted ? "Meta Alcançada" : "Saldo Faltante",
      rawValue: isCompleted ? e.currentCents : e.remainingCents,
      unit: "currency",
      tone: isCompleted ? "positive" : "default",
    },
  });
}

export interface SplitEvidencePart {
  participantId: string;
  participantName?: string;
  amountCents: number;
  settledCents: number;
}

export interface SplitEvidenceItem {
  id: string;
  title?: string;
  source: "share" | "legacy_debt";
  expenseCents: number;
  pendingCents: number;
  parts: readonly SplitEvidencePart[];
}

export interface SplitEvidence {
  items: readonly SplitEvidenceItem[];
  pendingCents: number;
  count: number;
}

export function buildSplitPendingBreakdown(e: SplitEvidence): CalculationBreakdown {
  const hasLegacyWithoutParts = e.items.some((i) => i.parts.length === 0);
  const steps: BreakdownStep[] = e.items.map((item) => {
    const settled = item.parts.reduce((acc, p) => acc + p.settledCents, 0);
    const hint =
      item.parts.length > 0
        ? `Despesa ${((item.expenseCents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Já quitado ${(settled / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Cota estimada (registro legado sem detalhamento de parcelas)";
    return {
      label: item.title ?? `Racha ${item.id}`,
      operator: "+",
      rawValue: item.pendingCents,
      unit: "currency",
      hint,
      tone: "positive",
    };
  });

  return enrichBreakdown({
    id: "overview-split-pending",
    title: "Rachas a Receber Pendentes",
    description: "Soma as parcelas em aberto dos convidados nos rachas ativos e recebíveis vinculados.",
    formulaExpression: "Pendente = Soma(Cota do Convidado - Valor Já Liquidado)",
    unit: "currency",
    steps,
    result: {
      label: `Total a Receber (${e.count} ${e.count === 1 ? "racha" : "rachas"})`,
      rawValue: e.pendingCents,
      unit: "currency",
      tone: "positive",
    },
    notes: hasLegacyWithoutParts
      ? ["Itens legados sem parcelas detalhadas exibem a cota estimada sem inferir participantes."]
      : undefined,
  });
}
