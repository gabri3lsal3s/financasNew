import { AlertTriangle, Check, Copy, FilePlus, RefreshCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DeduplicationAnalysis, DeduplicationStrategy, RestoreModuleKey } from "@/domain/export";
import { cn } from "@/lib/utils";

export interface StepDeduplicationProps {
  analysis: DeduplicationAnalysis;
  selectedModules: Set<RestoreModuleKey>;
  strategy: DeduplicationStrategy;
  onStrategyChange: (strategy: DeduplicationStrategy) => void;
  disabled?: boolean;
}

interface StrategyOption {
  value: DeduplicationStrategy;
  label: string;
  badge?: string;
  description: string;
  icon: typeof Check;
}

const STRATEGIES: StrategyOption[] = [
  {
    value: "skip",
    label: "Pular duplicados",
    badge: "Recomendado",
    description: "Mantém os dados atuais intactos e importa exclusivamente os registros inéditos.",
    icon: Check,
  },
  {
    value: "overwrite",
    label: "Sobrescrever existentes",
    description: "Atualiza os registros duplicados com as informações do backup e insere os novos.",
    icon: RefreshCcw,
  },
  {
    value: "keep_both",
    label: "Manter ambos",
    description: "Gera novos identificadores para os duplicados, preservando ambas as versões no histórico.",
    icon: Copy,
  },
  {
    value: "wipe_all",
    label: "Substituição completa",
    description: "Substitui integralmente as áreas selecionadas pelo conteúdo exato do arquivo de backup.",
    icon: Trash2,
  },
];

export function StepDeduplication({
  analysis,
  selectedModules,
  strategy,
  onStrategyChange,
  disabled,
}: StepDeduplicationProps) {
  // Contagens filtradas apenas pelos módulos selecionados
  let selectedBackupCount = 0;
  let selectedDuplicateCount = 0;
  let selectedNewCount = 0;

  for (const modKey of selectedModules) {
    const modSummary = analysis.byModule[modKey];
    if (modSummary) {
      selectedBackupCount += modSummary.backupCount;
      selectedDuplicateCount += modSummary.duplicateCount;
      selectedNewCount += modSummary.newCount;
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-route-in">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Identificação de duplicidades e política de mesclagem
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Comparamos os dados do backup com as informações já cadastradas na sua conta.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl border border-border/80 bg-surface flex flex-col justify-between">
          <span className="text-[11px] text-muted-foreground">Total no Backup</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-bold text-foreground tabular-nums">{selectedBackupCount}</span>
            <span className="text-[11px] text-muted-foreground">itens</span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-warning/30 bg-warning/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Duplicados Detectados</span>
            <AlertTriangle className="size-3.5 text-warning-strong" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-bold text-warning-strong tabular-nums">{selectedDuplicateCount}</span>
            <span className="text-[11px] text-muted-foreground">já existentes</span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-positive/30 bg-positive/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Registros Inéditos</span>
            <FilePlus className="size-3.5 text-positive-strong" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-bold text-positive-strong tabular-nums">{selectedNewCount}</span>
            <span className="text-[11px] text-muted-foreground">novos</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-1">
        <span className="text-xs font-semibold text-foreground">
          Escolha como deseja tratar os registros duplicados:
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {STRATEGIES.map((opt) => {
            const isSelected = strategy === opt.value;
            const Icon = opt.icon;

            return (
              <div
                key={opt.value}
                onClick={() => {
                  if (!disabled) onStrategyChange(opt.value);
                }}
                className={cn(
                  "p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                    : "border-border/80 bg-surface hover:border-border hover:bg-surface-hover/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "size-4 rounded-full border flex items-center justify-center shrink-0",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-surface",
                      )}
                    >
                      {isSelected ? <div className="size-1.5 rounded-full bg-primary-foreground" /> : null}
                    </div>
                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Icon className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                      {opt.label}
                    </span>
                  </div>
                  {opt.badge && (
                    <Badge variant="positive" size="xs">
                      {opt.badge}
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                  {opt.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
