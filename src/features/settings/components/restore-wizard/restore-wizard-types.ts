import type { BackupPayload } from "@/domain/export/backup";
import type {
  DeduplicationAnalysis,
  DeduplicationStrategy,
  RestoreExecutionSummary,
  RestoreModuleKey,
} from "@/domain/export/deduplication";

export type WizardStep = 1 | 2 | 3 | 4;

export interface RestoreWizardState {
  step: WizardStep;
  file: File | null;
  parsedPayload: BackupPayload | null;
  selectedModules: Set<RestoreModuleKey>;
  strategy: DeduplicationStrategy;
  analysis: DeduplicationAnalysis | null;
  isRestoring: boolean;
  isDone: boolean;
  error: string | null;
  executionSummary: RestoreExecutionSummary | null;
}

export const WIZARD_STEP_LABELS = [
  "Validação",
  "Módulos",
  "Desduplicação",
  "Confirmação",
] as const;
