import { useMemo, useState } from "react";
import { AlertCircle, Lock, PieChart, Wallet } from "lucide-react";
import { Badge, Button, Checkbox, Modal, ModalFooter, MoneyInput, MoneyText } from "@/components/ui";
import {
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "@/domain/goals";
import { usePortfolioPosition, useRealCashBalance } from "@/state";
import { triggerSensory } from "@/services/sensory";
import type {
  GoalCompositionConfig,
  GoalCompositionResult,
  GoalInvestmentSelectionMode,
} from "@/types/goals";

export interface GoalCompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: GoalCompositionConfig | null;
  targetCents: number;
  goalTitle?: string;
  isCompleted?: boolean;
  onSave: (config: GoalCompositionConfig, resolvedResult: GoalCompositionResult) => void;
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
  const { rows: positionRows, isLoading: isPositionLoading } = usePortfolioPosition();

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

  // Mapeamento dos ativos da carteira com quantidades e valores de mercado reais em centavos
  const portfolioAssets: PortfolioAssetCompositionItem[] = useMemo(() => {
    return positionRows
      .filter((r) => r.quantity > 0 || r.valueBRL > 0)
      .map((r) => ({
        id: r.assetId,
        ticker: r.ticker,
        assetClass: r.assetClass,
        quantity: r.quantity > 0 ? r.quantity : 1,
        valueCents: Math.round(r.valueBRL * 100),
        totalCostCents: Math.round(r.totalCostBRL * 100),
      }));
  }, [positionRows]);

  // Lista única de classes disponíveis a partir dos ativos com saldo
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const r of positionRows) {
      if ((r.quantity > 0 || r.valueBRL > 0) && r.assetClass && r.assetClass.trim().length > 0) {
        set.add(r.assetClass.trim());
      }
    }
    return Array.from(set).sort();
  }, [positionRows]);

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
    onSave(updated, preview);
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
              <div className="ml-0 sm:ml-7 pt-2 flex flex-col gap-3 border-t border-border/60">
                <div className="grid grid-cols-3 gap-1.5 w-full sm:flex sm:items-center sm:w-auto">
                  <Button
                    type="button"
                    variant={investmentMode === "selected_assets" ? "default" : "outline"}
                    size="sm"
                    className="h-8 sm:h-7 px-1.5 sm:px-3 text-[11px] sm:text-xs justify-center"
                    onClick={() => {
                      triggerSensory("selection");
                      setInvestmentMode("selected_assets");
                    }}
                  >
                    <span className="hidden sm:inline">Ativos Selecionados</span>
                    <span className="sm:hidden">Ativos</span>
                  </Button>
                  <Button
                    type="button"
                    variant={investmentMode === "selected_classes" ? "default" : "outline"}
                    size="sm"
                    className="h-8 sm:h-7 px-1.5 sm:px-3 text-[11px] sm:text-xs justify-center"
                    onClick={() => {
                      triggerSensory("selection");
                      setInvestmentMode("selected_classes");
                    }}
                  >
                    <span className="hidden sm:inline">Por Classes</span>
                    <span className="sm:hidden">Classes</span>
                  </Button>
                  <Button
                    type="button"
                    variant={investmentMode === "entire_portfolio" ? "default" : "outline"}
                    size="sm"
                    className="h-8 sm:h-7 px-1.5 sm:px-3 text-[11px] sm:text-xs justify-center"
                    onClick={() => {
                      triggerSensory("selection");
                      setInvestmentMode("entire_portfolio");
                    }}
                  >
                    <span className="hidden sm:inline">Toda a Carteira</span>
                    <span className="sm:hidden">Toda</span>
                  </Button>
                </div>

                {investmentMode === "entire_portfolio" && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/80 border border-border/60 text-xs">
                    <span className="text-muted-foreground">Total da carteira em custódia:</span>
                    <MoneyText
                      cents={portfolioAssets.reduce((acc, a) => acc + a.valueCents, 0)}
                      tone="portfolio"
                      className="font-semibold tabular-nums"
                    />
                  </div>
                )}

                {investmentMode === "selected_assets" && (
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {isPositionLoading ? (
                      <p className="text-[11px] text-muted-foreground italic py-2">
                        Carregando investimentos da carteira...
                      </p>
                    ) : portfolioAssets.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic py-2">
                        Nenhum ativo com saldo positivo cadastrado na carteira.
                      </p>
                    ) : (
                      portfolioAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-surface hover:bg-surface-muted transition-colors cursor-pointer"
                          onClick={() => handleToggleAsset(asset.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              checked={selectedAssetIds.includes(asset.id)}
                              onCheckedChange={() => handleToggleAsset(asset.id)}
                            />
                            <span className="font-semibold text-foreground truncate">{asset.ticker}</span>
                            {asset.assetClass ? (
                              <span className="text-muted-foreground text-[10px] truncate">
                                {asset.assetClass}
                              </span>
                            ) : null}
                          </div>
                          <MoneyText
                            cents={asset.valueCents}
                            tone="default"
                            className="text-xs font-semibold tabular-nums shrink-0 ml-2"
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {investmentMode === "selected_classes" && (
                  <div className="flex flex-wrap gap-2">
                    {availableClasses.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic py-2">
                        Nenhuma classe de ativo com saldo identificada.
                      </p>
                    ) : (
                      availableClasses.map((cls) => (
                        <Badge
                          key={cls}
                          variant={selectedClasses.includes(cls) ? "default" : "muted"}
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => handleToggleClass(cls)}
                        >
                          {cls}
                        </Badge>
                      ))
                    )}
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
          Salvar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
