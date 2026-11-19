/**
 * Utilitários Auxiliares de Asserção Forense e Avaliação de Invariantes.
 */

import type { AuditModule, InvariantResult, InvariantSeverity, InvariantStatus } from "../types";

export interface CreateResultInput {
  id: string;
  name: string;
  module: AuditModule;
  severity?: InvariantSeverity;
  expected: string | number;
  found: string | number;
  divergence?: number;
  passed: boolean;
  message?: string;
  origin: string;
}

export function createAssertionResult(input: CreateResultInput): InvariantResult {
  const {
    id,
    name,
    module,
    severity = "critical",
    expected,
    found,
    divergence,
    passed,
    message,
    origin,
  } = input;

  let computedDivergence = divergence;
  if (computedDivergence === undefined) {
    if (typeof expected === "number" && typeof found === "number") {
      computedDivergence = Math.abs(expected - found);
    } else {
      computedDivergence = passed ? 0 : 1;
    }
  }

  const status: InvariantStatus = passed ? "passed" : "failed";
  const defaultMessage = passed
    ? `Asserção '${name}' aprovada: esperado=${expected}, encontrado=${found}.`
    : `DIVERGÊNCIA FORENSE em '${name}': esperado=${expected}, encontrado=${found} (delta=${computedDivergence}).`;

  return {
    id,
    name,
    module,
    status,
    severity,
    expected,
    found,
    divergence: computedDivergence,
    message: message ?? defaultMessage,
    origin,
    timestamp: new Date().toISOString(),
  };
}

/** Compara dois valores numéricos com tolerância de 1 centavo (0.01) */
export function areAmountsEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance;
}
