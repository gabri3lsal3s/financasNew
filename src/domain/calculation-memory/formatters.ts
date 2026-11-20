/**
 * Utilitários puros de formatação e serialização para Memória de Cálculo.
 *
 * Garante proteção estrita contra NaN, Infinity e denominadores nulos.
 * Cumpre a Regra 28 do AGENTS.md (formatação pt-BR canônica).
 */

import { formatCentsAsBRL } from "@/services/masks/money";
import { formatPercent } from "@/services/masks/percent";
import type { BreakdownStep, BreakdownUnit, CalculationBreakdown } from "./types";

/**
 * Formata um valor numérico bruto na unidade correspondente respeitando o padrão pt-BR.
 */
export function formatBreakdownValue(
  rawValue: number,
  unit: BreakdownUnit,
  fractionDigits?: number,
): string {
  if (!Number.isFinite(rawValue) || Number.isNaN(rawValue)) {
    switch (unit) {
      case "currency":
        return formatCentsAsBRL(0);
      case "percent":
        return "0,0%";
      case "months":
        return "0,0 meses";
      case "count":
        return "0";
      case "ratio":
        return "0,00x";
    }
  }

  switch (unit) {
    case "currency":
      return formatCentsAsBRL(Math.round(rawValue), { allowNegative: true });
    case "percent":
      return `${formatPercent(rawValue, fractionDigits ?? 1)}%`;
    case "months": {
      const formatted = formatPercent(rawValue, fractionDigits ?? 1);
      const isSingular = Math.abs(rawValue - 1) < 0.001;
      return `${formatted} ${isSingular ? "mês" : "meses"}`;
    }
    case "count":
      return Math.round(rawValue).toLocaleString("pt-BR");
    case "ratio":
      return `${formatPercent(rawValue, fractionDigits ?? 2)}x`;
  }
}

/**
 * Retorna o operador formatado com espaçamento uniforme para alinhamento tabular.
 */
export function formatOperator(op?: string): string {
  if (!op) return " ";
  if (op === "-") return "−";
  return op;
}

/**
 * Normaliza non-breaking spaces para espaços ASCII comuns em textos de cópia e exportação.
 */
export function normalizeSpaces(str: string): string {
  return str.replace(/\u00A0/g, " ");
}

/**
 * Gera a versão em texto plano estruturado da memória de cálculo para cópia em 1 toque.
 */
export function generatePlainTextBreakdown(breakdown: CalculationBreakdown): string {
  const lines: string[] = [];

  lines.push(`[Axi] ${breakdown.title}`);
  if (breakdown.periodLabel) {
    lines.push(`Período: ${breakdown.periodLabel}`);
  }
  if (breakdown.description) {
    lines.push(`Definição: ${breakdown.description}`);
  }
  if (breakdown.formulaExpression) {
    lines.push(`Fórmula: ${breakdown.formulaExpression}`);
  }
  lines.push("");

  for (const step of breakdown.steps) {
    const op = step.operator ? `${formatOperator(step.operator)} ` : "  ";
    const rawVal = step.formattedValue ?? formatBreakdownValue(step.rawValue, step.unit ?? breakdown.unit);
    const val = normalizeSpaces(rawVal);
    const hint = step.hint ? ` (${step.hint})` : "";
    lines.push(`${op}${step.label}: ${val}${hint}`);
  }

  const rawResultVal =
    breakdown.result.formattedValue ??
    formatBreakdownValue(breakdown.result.rawValue, breakdown.result.unit);
  const resultVal = normalizeSpaces(rawResultVal);
  lines.push(`= ${breakdown.result.label}: ${resultVal}`);

  if (breakdown.inclusions && breakdown.inclusions.length > 0) {
    lines.push("");
    lines.push(`Inclui: ${breakdown.inclusions.join("; ")}.`);
  }

  if (breakdown.exclusions && breakdown.exclusions.length > 0) {
    lines.push("");
    lines.push(`Exclui: ${breakdown.exclusions.join("; ")}.`);
  }

  if (breakdown.notes && breakdown.notes.length > 0) {
    lines.push("");
    lines.push(`Notas: ${breakdown.notes.join("; ")}.`);
  }

  return lines.join("\n");
}

/**
 * Garante que todos os passos e o resultado contenham `formattedValue` preenchido.
 */
export function enrichBreakdown(breakdown: CalculationBreakdown): CalculationBreakdown {
  const steps: BreakdownStep[] = breakdown.steps.map((step) => {
    const unit = step.unit ?? breakdown.unit;
    const formattedValue = step.formattedValue ?? formatBreakdownValue(step.rawValue, unit);
    return {
      ...step,
      unit,
      formattedValue,
    };
  });

  const resultFormatted =
    breakdown.result.formattedValue ??
    formatBreakdownValue(breakdown.result.rawValue, breakdown.result.unit);

  const enriched: CalculationBreakdown = {
    ...breakdown,
    steps,
    result: {
      ...breakdown.result,
      formattedValue: resultFormatted,
    },
  };

  enriched.copyText = breakdown.copyText ?? generatePlainTextBreakdown(enriched);
  return enriched;
}
