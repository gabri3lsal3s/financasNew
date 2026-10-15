import { CheckCircle2, Info, RefreshCw, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type {
  DeduplicationStrategy,
  RestoreExecutionSummary,
  RestoreModuleKey,
} from "@/domain/export";
import { RESTORE_MODULES } from "@/domain/export";

export interface StepConfirmationProps {
  selectedModules: Set<RestoreModuleKey>;
  strategy: DeduplicationStrategy;
  executionSummary: RestoreExecutionSummary | null;
  isRestoring: boolean;
  isDone: boolean;
  restoredCount: number;
}

const STRATEGY_LABELS: Record<DeduplicationStrategy, string> = {
  skip: "Pular duplicados (Preservar existentes)",
  overwrite: "Sobrescrever duplicados existentes",
  keep_both: "Manter ambos (Gerar novos IDs)",
  wipe_all: "Substituição completa da base",
};

export function StepConfirmation({
  selectedModules,
  strategy,
  executionSummary,
  isRestoring,
  isDone,
  restoredCount,
}: StepConfirmationProps) {
  if (isDone) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center gap-3 animate-route-in">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-positive/10 border border-positive/30 text-positive-strong">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">
            Restauração concluída com sucesso!
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Os dados selecionados foram processados e integrados à sua conta com isolamento e integridade referencial.
          </p>
        </div>
        <div className="mt-2 p-3 rounded-xl border border-border/80 bg-surface text-xs font-medium text-foreground">
          Total de {restoredCount} registros consolidados na base.
        </div>
      </div>
    );
  }

  if (isRestoring) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-4 animate-route-in">
        <RefreshCw className="size-8 animate-spin text-primary" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Processando restauração transacional...
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Validando restrições, integrando registros e atualizando tabelas no Supabase.
          </p>
        </div>
      </div>
    );
  }

  const selectedModuleLabels = RESTORE_MODULES.filter((m) =>
    selectedModules.has(m.key),
  ).map((m) => m.label);

  const toInsert = executionSummary?.totalToInsert ?? 0;
  const toUpdate = executionSummary?.totalToUpdate ?? 0;
  const toSkip = executionSummary?.totalToSkip ?? 0;

  return (
    <div className="flex flex-col gap-4 animate-route-in">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Revisão final antes de restaurar
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Confira o resumo das operações que serão executadas no banco de dados.
        </p>
      </div>

      <div className="p-4 rounded-xl border border-border/80 bg-surface flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border/60 gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Estratégia Escolhida:</span>
          <Badge variant="muted" size="sm" className="font-semibold text-foreground">
            {STRATEGY_LABELS[strategy]}
          </Badge>
        </div>

        <div className="flex flex-col gap-1.5 pb-3 border-b border-border/60">
          <span className="text-xs font-medium text-muted-foreground">Módulos que serão restaurados:</span>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {selectedModuleLabels.map((lbl) => (
              <Badge key={lbl} variant="muted" size="xs">
                {lbl}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="p-2.5 rounded-lg bg-surface-hover/80 border border-border/60">
            <span className="text-[10px] text-muted-foreground block">Novos / Inserções</span>
            <span className="text-sm font-bold text-positive-strong tabular-nums mt-0.5 block">
              +{toInsert}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-hover/80 border border-border/60">
            <span className="text-[10px] text-muted-foreground block">Atualizações</span>
            <span className="text-sm font-bold text-foreground tabular-nums mt-0.5 block">
              {toUpdate}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-hover/80 border border-border/60">
            <span className="text-[10px] text-muted-foreground block">Ignorados / Pulados</span>
            <span className="text-sm font-bold text-muted-foreground tabular-nums mt-0.5 block">
              {toSkip}
            </span>
          </div>
        </div>
      </div>

      {strategy === "wipe_all" ? (
        <Alert variant="error">
          <div className="flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 text-critical-strong mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              <strong>Atenção:</strong> Você selecionou a <em>Substituição completa</em>. Os dados atuais dos módulos selecionados serão limpos e substituídos exatamente pelo conteúdo do backup.
            </div>
          </div>
        </Alert>
      ) : (
        <Alert variant="info">
          <div className="flex items-start gap-2">
            <Info className="size-4 shrink-0 text-primary-strong mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              A restauração é executada de forma atômica e segura. Nenhuma transação externa ou de outros usuários é afetada graças ao isolamento por RLS.
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
}
