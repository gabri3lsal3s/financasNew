import { Briefcase, Copy, Plus } from "lucide-react";
import { Alert, Button, Tabs } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";

export type ReconcileFilterTab = "all" | "new" | "suggested" | "matched" | "duplicates" | "app_only";

export interface StatementReconcileToolbarProps {
  filter: ReconcileFilterTab;
  onFilterChange: (filter: ReconcileFilterTab) => void;
  duplicateCount: number;
  countAppOnly: number;
  allFilteredSelected: boolean;
  isPending: boolean;
  canAddManual: boolean;
  onOpenAddManual: () => void;
  onToggleAll: (selected: boolean) => void;
  onUncheckDuplicates?: () => void;
  isBusinessModeEnabled?: boolean;
  onSetScopeAll?: (scope: "personal" | "business") => void;
}

export function StatementReconcileToolbar({
  filter,
  onFilterChange,
  duplicateCount,
  countAppOnly,
  allFilteredSelected,
  isPending,
  canAddManual,
  onOpenAddManual,
  onToggleAll,
  onUncheckDuplicates,
  isBusinessModeEnabled = false,
  onSetScopeAll,
}: StatementReconcileToolbarProps) {
  const tabsList = [
    { value: "all", label: "Todos", content: null },
    { value: "new", label: "Novos", content: null },
    { value: "suggested", label: "Sugestões", content: null },
    { value: "matched", label: "Conciliados", content: null },
    ...(duplicateCount > 0
      ? [{ value: "duplicates", label: `Duplicatas (${duplicateCount})`, content: null }]
      : []),
    ...(countAppOnly > 0
      ? [{ value: "app_only", label: `No App apenas (${countAppOnly})`, content: null }]
      : []),
  ];

  return (
    <>
      {duplicateCount > 0 && filter !== "duplicates" ? (
        <Alert variant="warning" className="py-2 px-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Copy className="size-4 shrink-0 text-warning-strong" aria-hidden="true" />
              <span className="text-xs text-foreground">
                {duplicateCount === 1
                  ? "1 potencial duplicidade detectada nesta fatura."
                  : `${duplicateCount} potenciais duplicidades detectadas nesta fatura.`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  onFilterChange("duplicates");
                }}
                className="relative text-[11px] font-medium underline text-warning-strong hover:opacity-80 shrink-0 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-2"
              >
                Ver detalhes
              </button>
              {onUncheckDuplicates ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-warning-strong hover:bg-warning/15"
                  onClick={onUncheckDuplicates}
                >
                  Desmarcar duplicatas
                </Button>
              ) : null}
            </div>
          </div>
        </Alert>
      ) : null}

      {countAppOnly > 0 && filter !== "app_only" ? (
        <Alert variant="warning" className="py-2 px-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs leading-snug">
              {countAppOnly === 1
                ? "1 despesa do app não consta neste extrato."
                : `${countAppOnly} despesas do app não constam neste extrato.`}
            </span>
            <button
              type="button"
              onClick={() => {
                triggerSensory("selection");
                onFilterChange("app_only");
              }}
              className="relative text-[11px] font-medium underline hover:opacity-80 shrink-0 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-2"
            >
              Ver detalhes
            </button>
          </div>
        </Alert>
      ) : null}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="w-full min-w-0 flex-1">
          <Tabs
            value={filter}
            onValueChange={(val) => onFilterChange(val as ReconcileFilterTab)}
            items={tabsList}
          />
        </div>
        {filter !== "app_only" ? (
          <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-0.5 sm:pt-0">
            {canAddManual ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                className="text-xs h-8 gap-1"
                onClick={onOpenAddManual}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Adicionar linha
              </Button>
            ) : null}
            {isBusinessModeEnabled && onSetScopeAll ? (
              <div className="flex items-center gap-1 border-l border-border/80 pl-1.5 ml-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isPending}
                  className="h-7 px-2 text-[11px] font-semibold text-portfolio hover:bg-portfolio/10 cursor-pointer"
                  onClick={() => onSetScopeAll("business")}
                  title="Marcar todas as despesas da fatura como Meu Negócio (PJ)"
                >
                  <Briefcase className="size-3 mr-1" aria-hidden="true" />
                  Tudo PJ
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isPending}
                  className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => onSetScopeAll("personal")}
                  title="Marcar todas as despesas da fatura como Pessoal (PF)"
                >
                  Tudo PF
                </Button>
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              className="shrink-0 text-xs"
              onClick={() => onToggleAll(!allFilteredSelected)}
            >
              {allFilteredSelected ? "Desmarcar" : "Marcar todos"}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
