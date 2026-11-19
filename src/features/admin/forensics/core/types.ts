/**
 * Tipos Fundamentais do Laboratório Forense de Auditoria Sintética e Contínua.
 *
 * Módulo isomórfico e puro (sem dependências de UI, DOM ou Supabase).
 * Conforme AGENTS.md e FINANCIAL_MATH_SPEC.md.
 */

import type { JourneyExecutionResult } from "./journeys/types";

export type AuditModule =
  | "portfolio"
  | "insights"
  | "cards"
  | "loans"
  | "debts"
  | "trips"
  | "family"
  | "budgets"
  | "projection"
  | "auxiliary"
  | "lifecycle";

export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {
  portfolio: "Investimentos & Custódia",
  insights: "Inteligência & SmartAdvisor",
  cards: "Cartões & Faturas",
  loans: "Contratos de Crédito (Price/SAC)",
  debts: "Dívidas & Quitações",
  trips: "Modo Viagem & Racha",
  family: "Orçamento Familiar",
  budgets: "Orçamentos & Provisões",
  projection: "Cash Gap & Pistas de Liquidez",
  auxiliary: "Módulos Auxiliares (Pix, Backup, Cripto)",
  lifecycle: "Ciclo de Vida & Transições de Estado",
};

export type InvariantSeverity = "critical" | "warning" | "info";

export type InvariantStatus = "passed" | "failed" | "skipped";

export interface InvariantResult {
  id: string;
  name: string;
  module: AuditModule;
  status: InvariantStatus;
  severity: InvariantSeverity;
  expected: string | number;
  found: string | number;
  divergence: number;
  message: string;
  origin: string;
  timestamp: string;
}

export interface PersonaAuditResult {
  personaId: string;
  personaName: string;
  description: string;
  executionTimeMs: number;
  invariantsCount: number;
  passedCount: number;
  failedCount: number;
  results: InvariantResult[];
}

export interface ModuleAuditScore {
  module: AuditModule;
  label: string;
  score: number; // 0 - 100
  passed: number;
  failed: number;
  total: number;
}

export interface ForensicAuditReport {
  auditId: string;
  generatedAt: string;
  environment: "synthetic" | "live_anonymized";
  overallScore: number; // 0 - 100
  totalAssertions: number;
  totalPassed: number;
  totalFailed: number;
  durationMs: number;
  personas: PersonaAuditResult[];
  moduleScores: Record<AuditModule, ModuleAuditScore>;
  journeys?: JourneyExecutionResult[];
}
