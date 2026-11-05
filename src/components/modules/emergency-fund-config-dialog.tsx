import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Shield, Sparkles, Wallet } from "lucide-react";
import { Badge, Button, Checkbox, Modal, MoneyText } from "@/components/ui";
import {
  detectSuggestedReserveAssets,
  resolveEmergencyFundComposition,
  type PortfolioPositionRowLike,
} from "@/domain/projection";
import type { EmergencyFundConfig, EmergencySelectionMode } from "@/types";
import { cn } from "@/lib/utils";

export interface EmergencyFundConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: EmergencyFundConfig;
  onSave: (config: EmergencyFundConfig) => Promise<void>;
  realCashCents: number;
  portfolioRows: PortfolioPositionRowLike[];
  monthlyExpensesCents: number;
}

const SELECTION_MODES: Array<{
  value: EmergencySelectionMode;
  title: string;
  description: string;
}> = [
  {
    value: "selected_assets",
    title: "Ativos Selecionados a Dedo (Recomendado)",
    description: "Escolha exatamente quais ativos compõem sua reserva (ex: Tesouro Selic e CDBs 100% CDI).",
  },
  {
    value: "selected_classes",
    title: "Por Classes Inteiras",
    description: "Considere todos os ativos de determinadas classes (ex: todo o 'Tesouro Direto' ou 'Renda Fixa').",
  },
  {
    value: "entire_portfolio",
    title: "Toda a Carteira de Investimentos",
    description: "Considera o saldo total de todos os ativos investidos na custódia como reserva.",
  },
  {
    value: "auto_cash",
    title: "Apenas Caixa Automático (Legado)",
    description: "Considera somente ativos categorizados estritamente como 'Caixa' ou 'Reserva'.",
  },
];

export function EmergencyFundConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
  realCashCents,
  portfolioRows = [],
  monthlyExpensesCents,
}: EmergencyFundConfigDialogProps) {
  const [includeCheckingAccounts, setIncludeCheckingAccounts] = useState(
    config.includeCheckingAccounts ?? true,
  );
  const [selectionMode, setSelectionMode] = useState<EmergencySelectionMode>(
    config.selectionMode ?? "selected_assets",
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    config.selectedAssetIds ?? [],
  );
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    config.selectedClasses ?? [],
  );
  const [useNetValue, setUseNetValue] = useState(config.useNetValue ?? true);
  const [targetMonths, setTargetMonths] = useState<3 | 6 | 12>(config.targetMonths ?? 6);
  const [isSaving, setIsSaving] = useState(false);

  // Lista única de classes presentes na carteira
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const r of portfolioRows) {
      if (r.assetClass && r.quantity > 0 && (r.valueBRL ?? 0) > 0) {
        set.add(r.assetClass.trim());
      }
    }
    return Array.from(set).sort();
  }, [portfolioRows]);

  // Preview dinâmico da composição em tempo real enquanto o usuário ajusta
  const previewComposition = useMemo(() => {
    return resolveEmergencyFundComposition({
      config: {
        includeCheckingAccounts,
        selectionMode,
        selectedAssetIds,
        selectedClasses,
        useNetValue,
        targetMonths,
      },
      realCashCents,
      portfolioRows,
      monthlyExpensesCents,
    });
  }, [
    includeCheckingAccounts,
    selectionMode,
    selectedAssetIds,
    selectedClasses,
    useNetValue,
    targetMonths,
    realCashCents,
    portfolioRows,
    monthlyExpensesCents,
  ]);

  const coverageMonths =
    monthlyExpensesCents > 0
      ? Number((previewComposition.totalReserveCents / monthlyExpensesCents).toFixed(1))
      : 0;

  const handleToggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  };

  const handleToggleClass = (className: string) => {
    const norm = className.trim().toLowerCase();
    setSelectedClasses((prev) => {
      const exists = prev.some((c) => c.trim().toLowerCase() === norm);
      return exists
        ? prev.filter((c) => c.trim().toLowerCase() !== norm)
        : [...prev, className];
    });
  };

  const handleSuggestReserveAssets = () => {
    const suggested = detectSuggestedReserveAssets(portfolioRows);
    setSelectedAssetIds(suggested);
  };

  const handleSelectAllAssets = () => {
    const allIds = portfolioRows
      .filter((r) => r.quantity > 0 && (r.valueBRL ?? 0) > 0)
      .map((r) => r.assetId);
    setSelectedAssetIds(allIds);
  };

  const handleClearAssets = () => {
    setSelectedAssetIds([]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        includeCheckingAccounts,
        selectionMode,
        selectedAssetIds,
        selectedClasses,
        useNetValue,
        targetMonths,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 w-full">
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSaving}
        className="w-full sm:w-auto"
      >
        Cancelar
      </Button>
      <Button
        type="button"
        variant="default"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full sm:w-auto"
      >
        {isSaving ? "Salvando..." : "Salvar Composição"}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Composição da Reserva de Emergência"
      description="Personalize quais contas e ativos de investimentos garantem a sua autonomia financeira."
      footer={footer}
    >
      <div className="flex flex-col gap-5 text-sm min-w-0">
        {/* Painel Resumo em Tempo Real */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">Reserva Total Configurada</span>
            <MoneyText
              cents={previewComposition.totalReserveCents}
              tone="positive"
              className="text-xl font-bold font-display tabular-nums whitespace-nowrap"
            />
            <span className="text-[11px] text-muted-foreground">
              {previewComposition.cashInAccountsCents > 0 && (
                <span>
                  Contas: <MoneyText cents={previewComposition.cashInAccountsCents} tone="default" className="font-medium" />
                </span>
              )}
              {previewComposition.cashInAccountsCents > 0 && previewComposition.portfolioReserveCents > 0 && " + "}
              {previewComposition.portfolioReserveCents > 0 && (
                <span>
                  Investimentos: <MoneyText cents={previewComposition.portfolioReserveCents} tone="default" className="font-medium" />
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-col sm:items-end gap-1">
            <span className="text-xs font-medium text-muted-foreground">Cobertura Estimada</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold font-display text-foreground tabular-nums">
                {coverageMonths} {coverageMonths === 1 ? "mês" : "meses"}
              </span>
              <span className="text-xs text-muted-foreground">
                (~{Math.round(coverageMonths * 30)} dias)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>Meta pessoal ({targetMonths}m):</span>
              <span className="font-semibold text-foreground tabular-nums">
                {previewComposition.targetMonthsProgressPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* 1. Origem: Contas Correntes / Caixa Real */}
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-surface-hover text-muted-foreground shrink-0">
                <Wallet className="size-4" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">Saldo em Contas Correntes</span>
                <span className="text-xs text-muted-foreground">
                  Considera o saldo líquido de contas e caixas como capital de emergência imediato.
                </span>
              </div>
            </div>
            <Checkbox
              checked={includeCheckingAccounts}
              onCheckedChange={setIncludeCheckingAccounts}
              aria-label="Incluir contas correntes na reserva"
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs pt-2 border-t border-border/50">
            <span className="text-muted-foreground">Disponível em conta corrente:</span>
            <MoneyText cents={realCashCents} tone="default" className="font-semibold tabular-nums" />
          </div>
        </div>

        {/* 2. Seleção de Modo dos Investimentos */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">Investimentos na Reserva</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SELECTION_MODES.map((mode) => {
              const isSelected = selectionMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setSelectionMode(mode.value)}
                  className={cn(
                    "flex flex-col text-left p-3 rounded-lg border transition-all min-w-0",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border/60 hover:bg-surface-hover hover:border-border",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-xs font-semibold", isSelected ? "text-primary" : "text-foreground")}>
                      {mode.title}
                    </span>
                    {isSelected && <CheckCircle2 className="size-3.5 text-primary shrink-0" aria-hidden="true" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {mode.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sub-painel: Ativos Selecionados a Dedo */}
          {selectionMode === "selected_assets" && (
            <div className="flex flex-col gap-2.5 mt-2 pt-3 border-t border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Selecione os Ativos da Carteira ({selectedAssetIds.length} selecionado{selectedAssetIds.length === 1 ? "" : "s"}):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSuggestReserveAssets}
                    className="h-7 px-2 text-xs text-primary hover:text-primary"
                  >
                    <Sparkles className="size-3.5 mr-1" aria-hidden="true" />
                    Sugerir Liquidez Diária
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllAssets}
                    className="h-7 px-2 text-xs text-muted-foreground"
                  >
                    Marcar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAssets}
                    className="h-7 px-2 text-xs text-muted-foreground"
                  >
                    Limpar
                  </Button>
                </div>
              </div>

              {portfolioRows.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Nenhum ativo com saldo em custódia encontrado na carteira.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                  {portfolioRows
                    .filter((r) => r.quantity > 0 && (r.valueBRL ?? 0) > 0)
                    .map((row) => {
                      const isChecked = selectedAssetIds.includes(row.assetId);
                      const isLikely =
                        row.isCash ||
                        row.ticker.toUpperCase().includes("SELIC") ||
                        row.ticker.toUpperCase().includes("CDI") ||
                        row.ticker.toUpperCase().includes("LFT");
                      const netVal = row.netValueBRL ?? row.valueBRL ?? 0;

                      return (
                        <div
                          key={row.assetId}
                          onClick={() => handleToggleAsset(row.assetId)}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors text-xs gap-3",
                            isChecked
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/50 hover:bg-surface-hover",
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleToggleAsset(row.assetId)}
                              aria-label={`Selecionar ${row.ticker}`}
                            />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-foreground truncate">{row.ticker}</span>
                                {row.assetClass && (
                                  <Badge variant="muted" size="xs">
                                    {row.assetClass}
                                  </Badge>
                                )}
                                {isLikely && (
                                  <Badge variant="positive" size="xs">
                                    Liquidez Diária
                                  </Badge>
                                )}
                                {row.isMatured && (
                                  <Badge variant="warning" size="xs">
                                    Vencido
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <MoneyText
                              cents={Math.round(netVal * 100)}
                              tone={isChecked ? "positive" : "default"}
                              className="font-semibold tabular-nums whitespace-nowrap"
                            />
                            {useNetValue && row.netValueBRL && row.valueBRL && row.netValueBRL !== row.valueBRL && (
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                Bruto: <MoneyText cents={Math.round(row.valueBRL * 100)} tone="default" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Sub-painel: Classes Selecionadas */}
          {selectionMode === "selected_classes" && (
            <div className="flex flex-col gap-2.5 mt-2 pt-3 border-t border-border/60">
              <span className="text-xs font-semibold text-foreground">
                Selecione as Classes que Pertencem à Reserva:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableClasses.map((cls) => {
                  const isChecked = selectedClasses.some(
                    (c) => c.trim().toLowerCase() === cls.trim().toLowerCase(),
                  );
                  return (
                    <label
                      key={cls}
                      onClick={() => handleToggleClass(cls)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors text-xs",
                        isChecked
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/50 hover:bg-surface-hover",
                      )}
                    >
                      <span className="font-medium text-foreground">{cls}</span>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleClass(cls)}
                        aria-label={`Selecionar classe ${cls}`}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. Parâmetros de Precisão & Meta Pessoal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Cálculo Líquido de IR */}
          <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Descontar IR Regressivo</span>
              <Checkbox
                checked={useNetValue}
                onCheckedChange={setUseNetValue}
                aria-label="Descontar IR regressivo da renda fixa"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              Utiliza o valor líquido estimado de resgate para títulos de renda fixa tributáveis.
            </span>
          </div>

          {/* Meta Pessoal de Autonomia */}
          <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
            <span className="text-xs font-semibold text-foreground">Meta Pessoal de Autonomia</span>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {([3, 6, 12] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={targetMonths === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTargetMonths(m)}
                  className="h-7 text-xs font-medium"
                >
                  {m} Meses
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Avisos & Inteligência Financeira Detectados */}
        {previewComposition.warnings.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-3.5 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-strong">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <span>Diagnósticos da Seleção Atual ({previewComposition.warnings.length}):</span>
            </div>
            <ul className="flex flex-col gap-1 text-[11px] text-muted-foreground pl-5 list-disc">
              {previewComposition.warnings.map((w) => (
                <li key={w.id}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
