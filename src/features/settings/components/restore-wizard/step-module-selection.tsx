import { ArrowLeftRight, CreditCard, FolderTree, Info, Receipt, Target, TrendingUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { RESTORE_MODULES, type RestoreModuleKey } from "@/domain/export";
import type { BackupPayload } from "@/domain/export/backup";
import { cn } from "@/lib/utils";

export interface StepModuleSelectionProps {
  payload: BackupPayload;
  selectedModules: Set<RestoreModuleKey>;
  onToggleModule: (key: RestoreModuleKey) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  disabled?: boolean;
}

const MODULE_ICONS: Record<RestoreModuleKey, typeof FolderTree> = {
  categories: FolderTree,
  cards: CreditCard,
  transactions: ArrowLeftRight,
  debts: Receipt,
  budgets: Target,
  investments: TrendingUp,
};

export function StepModuleSelection({
  payload,
  selectedModules,
  onToggleModule,
  onSelectAll,
  onClearAll,
  disabled,
}: StepModuleSelectionProps) {
  const getModuleBackupCount = (key: RestoreModuleKey): number => {
    const meta = RESTORE_MODULES.find((m) => m.key === key);
    if (!meta) return 0;
    return meta.tables.reduce((acc, table) => {
      const rows = payload.data[table];
      return acc + (Array.isArray(rows) ? rows.length : 0);
    }, 0);
  };

  const hasOrphanRisk =
    selectedModules.has("transactions") &&
    !selectedModules.has("categories") &&
    getModuleBackupCount("categories") > 0;

  return (
    <div className="flex flex-col gap-4 animate-route-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Selecione os módulos a restaurar
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Você pode restaurar a base integral ou escolher áreas específicas cirurgicamente.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            disabled={disabled}
            className="text-xs h-7 px-2"
          >
            Selecionar todos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            disabled={disabled}
            className="text-xs h-7 px-2 text-muted-foreground"
          >
            Limpar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RESTORE_MODULES.map((moduleMeta) => {
          const isSelected = selectedModules.has(moduleMeta.key);
          const count = getModuleBackupCount(moduleMeta.key);
          const Icon = MODULE_ICONS[moduleMeta.key];

          return (
            <div
              key={moduleMeta.key}
              onClick={() => {
                if (!disabled) onToggleModule(moduleMeta.key);
              }}
              className={cn(
                "p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3",
                isSelected
                  ? "border-primary/50 bg-primary/5 shadow-xs"
                  : "border-border/80 bg-surface hover:border-border hover:bg-surface-hover/50 opacity-80",
              )}
            >
              <div className="pt-0.5">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleModule(moduleMeta.key)}
                  disabled={disabled}
                  aria-label={moduleMeta.label}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-xs text-foreground truncate">
                      {moduleMeta.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-md tabular-nums shrink-0",
                      isSelected
                        ? "bg-primary/10 text-primary-strong"
                        : "bg-surface-hover text-muted-foreground",
                    )}
                  >
                    {count} {count === 1 ? "item" : "itens"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {moduleMeta.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasOrphanRisk && (
        <Alert variant="warning">
          <div className="flex items-center gap-2">
            <Info className="size-4 shrink-0 text-warning-strong" aria-hidden="true" />
            <span className="text-xs leading-relaxed">
              Você selecionou <strong>Transações</strong> sem incluir <strong>Categorias</strong>. Se os lançamentos utilizarem categorias novas do backup, elas podem ficar marcadas como &quot;Sem categoria&quot;.
            </span>
          </div>
        </Alert>
      )}

      {selectedModules.size === 0 && (
        <p className="text-xs text-critical text-center py-2">
          Selecione ao menos um módulo para prosseguir com a restauração.
        </p>
      )}
    </div>
  );
}
