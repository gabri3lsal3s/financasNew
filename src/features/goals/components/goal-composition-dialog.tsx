import { useMemo, useState } from "react";
import { AlertCircle, Lock, PieChart, Wallet } from "lucide-react";
import { Badge, Button, Checkbox, Modal, ModalFooter, MoneyInput, MoneyText } from "@/components/ui";
import {
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "@/domain/goals";
import { usePortfolioAssets, useRealCashBalance } from "@/state";
import { triggerSensory } from "@/services/sensory";
import type { GoalCompositionConfig, GoalInvestmentSelectionMode } from "@/types/goals";

export interface GoalCompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: GoalCompositionConfig | null;
  targetCents: number;
  goalTitle?: string;
  isCompleted?: boolean;
  onSave: (config: GoalCompositionConfig) => void;
}

export function GoalCompositionDialog({
  open,
  onOpenChange,
  config,
  targetCents,
  goalTitle,
  isCompleted = false,
  onSave,
}: GoalCompositionDialogProps) {
  const { cashBalance } = useRealCashBalance();
  const assetsQuery = usePortfolioAssets();
  const rawAssets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);

  // Estado interno do formulário de composição
  const [includeCheckingAccounts, setIncludeCheckingAccounts] = useState(
    config?.includeCheckingAccounts ?? true,
  );
  const [includeInvestments, setIncludeInvestments] = useState(
    config?.includeInvestments ?? false,
  );
  const [investmentMode, setInvestmentMode] = useState<GoalInvestmentSelectionMode>(
    config?.investmentMode ?? "selected_assets",
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    config?.assetIds ?? [],
  );
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    config?.classes ?? [],
  );
  const [allocationCapCents, setAllocationCapCents] = useState<number | undefined>(
    config?.allocationCapCents ?? undefined,
  );
  const [isCompletedLocked, setIsCompletedLocked] = useState(
    config?.isCompletedLocked ?? false,
  );

  // Mapeamento das contas bancárias / caixa
  const accounts: AccountCompositionItem[] = useMemo(() => {
    const currentBalance = Math.max(0, cashBalance?.currentBalanceCents ?? 0);
    return [
      {
        id: "main_cash",
        name: "Saldo em Conta Corrente / Caixa Geral",
        balanceCents: currentBalance,
        pendingObligationsCents: 0,
      },
    ];
  }, [cashBalance]);

  // Mapeamento dos ativos da carteira
  const portfolioAssets: PortfolioAssetCompositionItem[] = useMemo(() => {
    return rawAssets.map((a) => ({
      id: a.id,
      ticker: a.ticker,
      assetClass: a.asset_class,
      quantity: 1,
      valueCents: 0, // calculado pelo motor ou herdado
      totalCostCents: 0,
    }));
  }, [rawAssets]);

  // Lista única de classes disponíveis
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const a of rawAssets) {
      if (a.asset_class && a.asset_class.trim().length > 0) {
        set.add(a.asset_class.trim());
      }
    }
    return Array.from(set).sort();
  }, [rawAssets]);

  // Preview em tempo real da composição patrimonial
  const preview = useMemo(() => {
    const activeConfig: GoalCompositionConfig = {
      includeCheckingAccounts,
      accountIds: null,
      includeInvestments,
      investmentMode,
      assetIds: selectedAssetIds,
      classes: selectedClasses,
      allocationCapCents: allocationCapCents && allocationCapCents > 0 ? allocationCapCents : null,
      isCompletedLocked,
    };

    return resolveGoalComposition({
      config: activeConfig,
      targetCents,
      accounts,
      assets: portfolioAssets,
      previouslyLockedAsCompleted: isCompleted,
    });
  }, [
    includeCheckingAccounts,
    includeInvestments,
    investmentMode,
    selectedAssetIds,
    selectedClasses,
    allocationCapCents,
    isCompletedLocked,
    targetCents,
    accounts,
    portfolioAssets,
    isCompleted,
  ]);

  const handleToggleAsset = (assetId: string) => {
    triggerSensory("selection");
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  };

  const handleToggleClass = (className: string) => {
    triggerSensory("selection");
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className],
    );
  };

  const handleSave = () => {
    triggerSensory("action");
    const updated: GoalCompositionConfig = {
      includeCheckingAccounts,
      accountIds: null,
      includeInvestments,
      investmentMode,
      assetIds: selectedAssetIds,
      classes: selectedClasses,
      allocationCapCents: allocationCapCents && allocationCapCents > 0 ? allocationCapCents : null,
      isCompletedLocked,
    };
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Termômetro Patrimonial da Meta"
      description={`Conecte ${goalTitle ? `"${goalTitle}"` : "esta meta"} ao seu saldo em conta ou aos investimentos para atualizar o progresso automaticamente.`}
      size="lg"
    >
      <div className="flex flex-col gap-4 p-4 text-xs">
        {/* Painel de Preview Dinâmico */}
        <div className="rounded-xl border border-border/80 bg-surface/90 p-3.5 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Progresso Previsto
            </span>
            <Badge
              variant={preview.isReached ? "positive" : "portfolio"}
              size="xs"
              className="font-semibold"
            >
              {Math.round(preview.progressPercent)}% Concluído
            </Badge>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-lg font-bold text-foreground">
                <MoneyText cents={preview.currentCents} tone="default" />
              </span>
              <span className="text-muted-foreground ml-1.5">
                de <MoneyText cents={targetCents} tone="default" />
              </span>
            </div>
            {preview.isCapApplied && (
              <Badge variant="warning" size="xs">
                Teto Aplicado
              </Badge>
            )}
          </div>

          {/* Barra Bicolor: Aportes (sólido) vs Rendimentos (gradiente) */}
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-full rounded-full bg-surface-muted overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(100, (preview.totalDesembolsadoCents / Math.max(1, targetCents)) * 100)}%`,
                }}
                className="h-full bg-primary transition-all duration-300"
                title="Aportes e Desembolsos Realizados"
              />
              <div
                style={{
                  width: `${Math.min(100 - (preview.totalDesembolsadoCents / Math.max(1, targetCents)) * 100, (preview.totalRendimentosCents / Math.max(1, targetCents)) * 100)}%`,
                }}
                className="h-full bg-portfolio transition-all duration-300"
                title="Rendimentos e Juros Compostos"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                <span>Aportes: <MoneyText cents={preview.totalDesembolsadoCents} /></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-portfolio" />
                <span>Rendimentos: <MoneyText cents={preview.totalRendimentosCents} /></span>
              </div>
            </div>
          </div>

          {preview.warnings.length > 0 && (
            <div className="rounded-lg bg-warning/10 border border-warning/20 p-2 text-[11px] text-warning-strong flex flex-col gap-1">
              {preview.warnings.map((w, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seleção de Fontes */}
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-foreground text-sm">Fontes de Composição</p>

          {/* Caixa / Contas Bancárias */}
          <div className="flex items-start gap-3 rounded-xl border border-border/70 p-3 bg-surface/40 hover:bg-surface/70 transition-colors">
            <Checkbox
              id="toggle-checking"
              checked={includeCheckingAccounts}
              onCheckedChange={(c) => {
                triggerSensory("selection");
                setIncludeCheckingAccounts(Boolean(c));
              }}
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

          {/* Investimentos na Custódia */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 p-3 bg-surface/40">
            <div className="flex items-start gap-3">
              <Checkbox
                id="toggle-investments"
                checked={includeInvestments}
                onCheckedChange={(c) => {
                  triggerSensory("selection");
                  setIncludeInvestments(Boolean(c));
                }}
                className="mt-0.5"
              />
              <label htmlFor="toggle-investments" className="flex flex-col gap-0.5 cursor-pointer flex-1">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <PieChart className="size-3.5 text-portfolio" aria-hidden="true" />
                  <span>Ativos da Carteira de Investimentos</span>
                </span>
                <span className="text-muted-foreground text-[11px]">
                  Sincroniza o valor de mercado atualizado dos seus investimentos custodiados.
                </span>
              </label>
            </div>

            {includeInvestments && (
              <div className="ml-7 pt-2 flex flex-col gap-3 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={investmentMode === "selected_assets" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      triggerSensory("selection");
                      setInvestmentMode("selected_assets");
                    }}
                  >
                    Ativos Selecionados
                  </Button>
                  <Button
                    type="button"
                    variant={investmentMode === "selected_classes" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      triggerSensory("selection");
                      setInvestmentMode("selected_classes");
                    }}
                  >
                    Por Classes
                  </Button>
                  <Button
                    type="button"
                    variant={investmentMode === "entire_portfolio" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      triggerSensory("selection");
                      setInvestmentMode("entire_portfolio");
                    }}
                  >
                    Toda a Carteira
                  </Button>
                </div>

                {investmentMode === "selected_assets" && (
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {rawAssets.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">
                        Nenhum ativo cadastrado na carteira.
                      </p>
                    ) : (
                      rawAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-surface hover:bg-surface-muted transition-colors cursor-pointer"
                          onClick={() => handleToggleAsset(asset.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedAssetIds.includes(asset.id)}
                              onCheckedChange={() => handleToggleAsset(asset.id)}
                            />
                            <span className="font-semibold text-foreground">{asset.ticker}</span>
                            <span className="text-muted-foreground text-[10px]">
                              {asset.asset_class}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {investmentMode === "selected_classes" && (
                  <div className="flex flex-wrap gap-2">
                    {availableClasses.map((cls) => (
                      <Badge
                        key={cls}
                        variant={selectedClasses.includes(cls) ? "default" : "muted"}
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => handleToggleClass(cls)}
                      >
                        {cls}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Teto Anti-Double Counting e Trava de Conclusão */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">
              Teto Exclusivo Alocado (Opcional)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Limite máximo para não contar duas vezes o mesmo saldo em metas distintas.
            </span>
            <MoneyInput
              cents={allocationCapCents ?? 0}
              onCentsChange={(c) =>
                setAllocationCapCents(c > 0 ? c : undefined)
              }
              placeholder="Sem teto (100% livre)"
              className="mt-1"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">
              Disciplina & Proteção de Mercado
            </span>
            <span className="text-[11px] text-muted-foreground">
              Congela a meta ao atingir 100% mesmo se ações ou fundos oscilarem.
            </span>
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="toggle-lock"
                checked={isCompletedLocked}
                onCheckedChange={(c) => {
                  triggerSensory("selection");
                  setIsCompletedLocked(Boolean(c));
                }}
              />
              <label htmlFor="toggle-lock" className="text-xs font-medium text-foreground cursor-pointer flex items-center gap-1">
                <Lock className="size-3 text-primary" aria-hidden="true" />
                <span>Congelar marco de conquista ao atingir 100%</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleSave}
        >
          Salvar Termômetro
        </Button>
      </ModalFooter>
    </Modal>
  );
}
