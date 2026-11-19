/**
 * Contratos de Jornadas Sintéticas de Ciclo de Vida (journeys/types.ts).
 *
 * Define a tipagem estrita de orquestração de jornadas completas de usuário
 * cobrindo os 8 pilares da aplicação em modo headless.
 * Conforme AGENTS.md (TypeScript estrito, sem emojis, centavos inteiros).
 */

import type { HeadlessStateStore } from "../engine/headless-state-store";
import type { HeadlessTransactionRouter } from "../engine/headless-transaction-router";

export type AppPillar =
  | "auth"
  | "subscription"
  | "categories"
  | "transactions"
  | "portfolio"
  | "goals_budgets"
  | "trips"
  | "insights";

export interface JourneyStepResult {
  stepNumber: number;
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

export interface JourneyExecutionResult {
  journeyId: string;
  name: string;
  pillar: AppPillar;
  passed: boolean;
  totalDurationMs: number;
  steps: JourneyStepResult[];
  error?: string;
}

export interface JourneyContext {
  store: HeadlessStateStore;
  router: HeadlessTransactionRouter;
}

export interface JourneyDefinition {
  id: string;
  name: string;
  pillar: AppPillar;
  description: string;
  execute: (ctx: JourneyContext) => Promise<JourneyExecutionResult> | JourneyExecutionResult;
}
