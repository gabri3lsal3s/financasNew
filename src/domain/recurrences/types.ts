/**
 * Tipos do domínio de recorrências — Fase 32 (proposta aprovada 2026-08-17).
 *
 * Contrato local do motor puro. Enums canônicos (`RECURRENCE_FREQUENCIES`,
 * `RECURRENCE_KINDS`, …) vivem em `src/types/schema.ts` (espelho das
 * constraints da migration 0013) — este módulo apenas os reexporta.
 */

import type { RecurrenceFrequency, RecurrenceKind } from "@/types";

export { RECURRENCE_FREQUENCIES, RECURRENCE_KINDS } from "@/types";
export type { RecurrenceFrequency, RecurrenceKind } from "@/types";

/**
 * Regra de recorrência (template) — fonte da verdade (Fase 32).
 *
 * Fim sempre definido: exatamente um entre `endDate` e `occurrencesTotal`
 * (CHECK no banco na Etapa 2; validado no motor em `resolveLimits`).
 */
export interface RecurrenceRule {
  id: string;
  kind: RecurrenceKind;
  frequency: RecurrenceFrequency;
  /** Valor da ocorrência em centavos (moeda em centavos dentro dos motores). */
  valueCents: number;
  /** YYYY-MM-DD — primeira ocorrência. */
  startDate: string;
  /** YYYY-MM-DD — última ocorrência (fim por data, inclusivo). */
  endDate: string | null;
  /** Nº de ocorrências (fim por contagem) — 1-based, inclui a primeira. */
  occurrencesTotal: number | null;
  /** Peso no relatório (0–1) — não participa do cálculo de datas. */
  reportWeight: number;
  isActive: boolean;
}

/**
 * Ocorrência concreta derivada da regra — espelho das linhas materializadas
 * (Etapa 2). `id` é estável e determinístico (`${recurrenceId}:${date}`),
 * permitindo prévia no wizard, materialização idempotente e resolução de
 * exclusão/edição em grupo no cache otimista.
 */
export interface RecurrenceOccurrence {
  id: string;
  recurrenceId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** 1-based. */
  occurrenceNumber: number;
  valueCents: number;
}
