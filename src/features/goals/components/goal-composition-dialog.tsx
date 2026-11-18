import { Lock, Wallet } from "lucide-react";
import { Button, Checkbox, Modal, ModalFooter, MoneyInput } from "@/components/ui";
import type { GoalCompositionConfig, GoalCompositionResult } from "@/types/goals";
import { GoalCompositionPreviewCard } from "./goal-composition/GoalCompositionPreviewCard";
import { GoalInvestmentsSelector } from "./goal-composition/GoalInvestmentsSelector";
import { useGoalAssetSelection } from "./goal-composition/use-goal-asset-selection";

export interface GoalCompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: GoalCompositionConfig | null;
  targetCents: number;
  goalTitle?: string;
  isCompleted?: boolean;
  onSave: (config: GoalCompositionConfig, resolvedResult: GoalCompositionResult) => void;
}

function GoalCompositionDialogInner({
  open,
  onOpenChange,
  config,
  targetCents,
  goalTitle,
  isCompleted = false,
  onSave,
}: GoalCompositionDialogProps) {
  const state = useGoalAssetSelection({ config, targetCents, isCompleted });

  const handleSave = () => {
    onSave(state.activeConfig, state.preview);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Termômetro Patrimonial da Meta"
      description={`Conecte ${goalTitle ? `"${goalTitle}"` : "esta meta"} ao seu saldo em conta ou aos investimentos para atualizar o progresso automaticamente.`}
      size="lg"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="default" sensoryIntent="success" onClick={handleSave}>
            Salvar
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-2 text-xs">
        <GoalCompositionPreviewCard preview={state.preview} targetCents={targetCents} />

        <div className="flex flex-col gap-3">
          <p className="font-semibold text-foreground text-sm">Fontes de Composição</p>

          <div className="flex items-start gap-3 rounded-xl border border-border/80 p-3 bg-surface hover:bg-surface-hover/50 transition-colors">
            <Checkbox
              id="toggle-checking"
              checked={state.includeCheckingAccounts}
              onCheckedChange={(c) => state.setIncludeCheckingAccounts(Boolean(c))}
              className="mt-0.5"
            />
            <label htmlFor="toggle-checking" className="flex flex-col gap-0.5 cursor-pointer flex-1">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Wallet className="size-3.5 text-primary" aria-hidden="true" />
                <span>Saldo em Conta Corrente / Caixa Geral</span>
              </span>
              <span className="text-muted-foreground text-[11px]">
                Considera o saldo livre disponível em caixa após quitação de faturas e contas pendentes.
              </span>
            </label>
          </div>

          <GoalInvestmentsSelector
            includeInvestments={state.includeInvestments}
            onIncludeInvestmentsChange={state.setIncludeInvestments}
            investmentMode={state.investmentMode}
            onInvestmentModeChange={state.setInvestmentMode}
            isPositionLoading={state.isPositionLoading}
            portfolioAssets={state.portfolioAssets}
            selectedAssetIds={state.selectedAssetIds}
            onToggleAsset={state.toggleAsset}
            availableClasses={state.availableClasses}
            selectedClasses={state.selectedClasses}
            onToggleClass={state.toggleClass}
            totalPortfolioCents={state.totalPortfolioCents}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-allocation-cap" className="text-xs font-semibold text-foreground">
              Teto Exclusivo Alocado <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <MoneyInput
              id="goal-allocation-cap"
              cents={state.allocationCapCents ?? 0}
              onCentsChange={(c) => state.setAllocationCapCents(c > 0 ? c : undefined)}
              placeholder="Sem teto (100% livre)"
            />
            <span className="text-[11px] text-muted-foreground">
              Limite máximo para não contar duas vezes o mesmo saldo em metas distintas.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Disciplina &amp; Proteção de Mercado
            </span>
            <span className="text-[11px] text-muted-foreground">
              Congela a meta ao atingir 100% mesmo se ações ou fundos oscilarem.
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Checkbox
                id="toggle-lock"
                checked={state.isCompletedLocked}
                onCheckedChange={(c) => state.setIsCompletedLocked(Boolean(c))}
              />
              <label htmlFor="toggle-lock" className="text-xs font-medium text-foreground cursor-pointer flex items-center gap-1">
                <Lock className="size-3 text-primary" aria-hidden="true" />
                <span>Congelar marco de conquista ao atingir 100%</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function GoalCompositionDialog(props: GoalCompositionDialogProps) {
  if (!props.open) return null;
  return <GoalCompositionDialogInner key={props.goalTitle ?? "goal"} {...props} />;
}
