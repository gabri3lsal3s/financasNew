import { useMemo } from "react";
import { Coins, Info, SlidersHorizontal, Sparkles } from "lucide-react";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { buildAporteBreakdown } from "@/domain/calculation-memory";
import { numberToCents } from "@/domain/money";
import type {
  AporteOverflowEvent,
  ClassAporteSummary,
  DiversificationImpactSummary,
  PausedAssetDiagnostic,
  SectorAporteSummary,
  SkippedAssetDiagnostic,
} from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks";

export interface AporteCockpitCommandCardProps {
  aporteCents: number;
  onAporteCentsChange: (cents: number) => void;
  availableCashCents: number;
  useBrokerageCash: boolean;
  onToggleBrokerageCash: (checked: boolean) => void;
  effectiveCashSelectedCents: number;
  onCashSelectedChange: (cents: number) => void;
  onUseOnlyCash: () => void;
  strategy?: "optimized" | "proportional";
  onStrategyChange?: (strategy: "optimized" | "proportional") => void;
  cashHighlight?: boolean;

  // Síntese
  effectiveTotalAllocated: number;
  effectiveLeftover: number;
  completedCount?: number;
  totalRoutesCount?: number;
  diversificationImpact?: DiversificationImpactSummary | null;
  overflowEventsCount?: number;
  onOpenOverflowLedger?: () => void;
  className?: string;

  // Memória de cálculo e auditoria
  classSummaries?: readonly ClassAporteSummary[];
  sectorSummaries?: readonly SectorAporteSummary[];
  skippedAssets?: readonly SkippedAssetDiagnostic[];
  pausedAssets?: readonly PausedAssetDiagnostic[];
  overflowEvents?: readonly AporteOverflowEvent[];
}

/**
 * AporteCockpitCommandCard (§Fase 4.5):
 * Coluna Esquerda do Cockpit Superior Simétrico.
 * Funde os controles de entrada e o resumo de síntese em um único card sem aninhamento,
 * mantendo altura equilibrada com o card de alocação da direita.
 */
export function AporteCockpitCommandCard({
  aporteCents,
  onAporteCentsChange,
  availableCashCents,
  useBrokerageCash,
  onToggleBrokerageCash,
  effectiveCashSelectedCents,
  onCashSelectedChange,
  onUseOnlyCash,
  strategy = "optimized",
  onStrategyChange,
  cashHighlight = false,

  effectiveTotalAllocated,
  effectiveLeftover,
  completedCount = 0,
  totalRoutesCount = 0,
  diversificationImpact,
  overflowEventsCount,
  onOpenOverflowLedger,
  className,
  classSummaries,
  sectorSummaries,
  skippedAssets,
  pausedAssets,
  overflowEvents,
}: AporteCockpitCommandCardProps) {
  const totalPurchasingCents = aporteCents + (useBrokerageCash ? effectiveCashSelectedCents : 0);
  const hasAporte = totalPurchasingCents > 0;

  const aporteBreakdown = useMemo(() => {
    return buildAporteBreakdown({
      aporteTotalBRL: totalPurchasingCents / 100,
      pocketAmountBRL: aporteCents / 100,
      cashUsedBRL: (useBrokerageCash ? effectiveCashSelectedCents : 0) / 100,
      totalAllocatedBRL: effectiveTotalAllocated,
      leftoverBRL: effectiveLeftover,
      classSummaries,
      sectorSummaries,
      skippedAssets,
      pausedAssets,
      overflowEvents,
      strategy,
    });
  }, [
    aporteCents,
    classSummaries,
    effectiveCashSelectedCents,
    effectiveLeftover,
    effectiveTotalAllocated,
    overflowEvents,
    pausedAssets,
    sectorSummaries,
    skippedAssets,
    strategy,
    totalPurchasingCents,
    useBrokerageCash,
  ]);

  return (
    <section
      aria-label="Comando e síntese do aporte"
      data-tour="investments-rebalance"
      className={cn(
        "group flex flex-col justify-between h-full rounded-2xl border border-border/80 bg-surface p-4 sm:p-4.5 shadow-xs min-w-0",
        className,
      )}
    >
      {/* 1. PARTE SUPERIOR: Cabeçalho Simétrico & Entrada */}
      <div className="flex flex-col gap-3 min-w-0 w-full">
        {/* Cabeçalho do Cockpit (Simétrico ao AllocationCard) */}
        <div className="flex items-center justify-between gap-2.5 pb-1 border-b border-border/40">
          <div className="flex items-center gap-2 min-w-0">
            <Coins className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">
              Parâmetros do Aporte
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasAporte ? (
              <Badge variant="portfolio" size="xs" className="font-mono font-semibold">
                Simulando
              </Badge>
            ) : (
              <span className="text-[11px] font-normal text-muted-foreground">Pronto</span>
            )}
            <CalculationMemoryModal breakdown={aporteBreakdown} priority="p0" />
          </div>
        </div>

        {/* Campo de Dinheiro Novo */}
        <FormField label="Valor do aporte (dinheiro novo)" htmlFor="aporte-value-input">
          <MoneyInput
            id="aporte-value-input"
            cents={aporteCents}
            onCentsChange={onAporteCentsChange}
            size="md"
            showCalculatorAction
            aria-label="Valor do aporte"
            placeholder="R$ 0,00"
            className="tabular-nums text-base sm:text-sm"
          />
        </FormField>

        {/* Estratégia de Alocação com Explicação do Motor Hierárquico */}
        {onStrategyChange ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Estratégia de Alocação</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Sobre o motor hierárquico"
                      className="inline-flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
                    >
                      <Info className="size-3.5" aria-hidden="true" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-3.5 flex flex-col gap-2.5 text-left">
                    <div className="flex items-start gap-2.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-raised border border-border/80 text-primary">
                        <Sparkles className="size-3.5" aria-hidden="true" />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground leading-tight">
                          Como funcionam os cálculos de alocação?
                        </span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          O <strong>Motor Hierárquico</strong> calcula e equilibra seus aportes em três etapas sucessivas:
                        </p>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-1.5 text-[11px] text-muted-foreground border-t border-border/50 pt-2 pl-1">
                      <li className="flex items-start gap-1.5">
                        <span className="font-semibold text-foreground shrink-0">1. Macroclasses:</span>
                        <span>Estabiliza primeiro as classes mais defasadas (Ações, FIIs, Renda Fixa...).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-semibold text-foreground shrink-0">2. Meso-Setores:</span>
                        <span>Prioriza setores deficitários dentro da classe para evitar concentração.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="font-semibold text-foreground shrink-0">3. Ativos &amp; Notas:</span>
                        <span>Distribui proporcionalmente pelos pesos das Notas de convicção (0 a 10).</span>
                      </li>
                    </ul>
                  </PopoverContent>
                </Popover>
              </span>
              <span className="text-[11px] font-normal text-muted-foreground hidden sm:inline">
                {strategy === "optimized" ? "Reconcentra nos mais defasados" : "Espalha proporcional"}
              </span>
            </div>
            <SegmentedControl
              value={strategy}
              onChange={(val) => onStrategyChange(val as "optimized" | "proportional")}
              options={[
                {
                  value: "optimized",
                  label: "Menos Movimentações",
                  title: "Prioriza ativos mais deficitários e evita ordens de micro-valor",
                },
                {
                  value: "proportional",
                  label: "Proporcional",
                  title: "Distribui verba entre todos os ativos com gap positivo",
                },
              ]}
              ariaLabel="Estratégia de distribuição de aporte"
            />
          </div>
        ) : null}

        {/* Linha Compacta de Saldo em Caixa */}
        {availableCashCents > 0 ? (
          <div
            className={cn(
              "flex flex-col gap-2.5 rounded-xl p-2.5 sm:p-3 transition-colors duration-200 border",
              cashHighlight
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "bg-surface-raised/70 border-border/50",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <Switch
                checked={useBrokerageCash}
                onCheckedChange={onToggleBrokerageCash}
                label={
                  <>
                    <span className="hidden sm:inline">Somar saldo em Caixa da corretora</span>
                    <span className="sm:hidden">Somar saldo em Caixa</span>
                  </>
                }
                className="flex-1 min-w-0"
                description={
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <span>Disponível:</span>
                    <MoneyText
                      cents={availableCashCents}
                      variant="caption"
                      tone="default"
                      className="text-muted-foreground font-medium tabular-nums"
                    />
                  </span>
                }
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onUseOnlyCash}
                className="text-[11px] h-6.5 px-2.5 shrink-0 cursor-pointer"
              >
                Usar apenas o Caixa
              </Button>
            </div>

            {/* Input Específico de Caixa Revelado Apenas Quando Ativo */}
            {useBrokerageCash ? (
              <div className="flex flex-col gap-2 border-t border-border/50 pt-2 animate-fade-in">
                <FormField
                  label={`Saldo em Caixa a utilizar (máx. ${formatCentsAsBRL(availableCashCents)})`}
                  htmlFor="aporte-cash-used-input"
                >
                  <MoneyInput
                    id="aporte-cash-used-input"
                    cents={effectiveCashSelectedCents}
                    onCentsChange={onCashSelectedChange}
                    size="sm"
                    showCalculatorAction
                    aria-label="Saldo em caixa utilizado"
                    placeholder="R$ 0,00"
                    className="tabular-nums text-base sm:text-sm"
                  />
                </FormField>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex flex-wrap items-center gap-1 text-[11px]">
                    <span>Bolso:</span>
                    <MoneyText cents={aporteCents} tone="default" className="font-semibold text-foreground" />
                    <span>+ Caixa:</span>
                    <MoneyText
                      cents={effectiveCashSelectedCents}
                      tone="default"
                      className="font-semibold text-foreground"
                    />
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <span className="text-[11px]">Total:</span>
                    <MoneyText cents={totalPurchasingCents} tone="portfolio" className="text-xs font-bold" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 2. PARTE INFERIOR: Síntese de Alocação e Impacto */}
      <div className="flex flex-col gap-2.5 min-w-0 pt-3">
        {/* Cápsula de Síntese em Superfície Coesa */}
        <div className="rounded-xl border border-border/50 bg-surface-raised/40 p-2.5 sm:p-3 shadow-xs">
          <div className="grid grid-cols-3 divide-x divide-border/50 text-center">
            <div className="flex flex-col px-1 min-w-0">
              <span className="text-[10px] font-medium text-muted-foreground truncate" title="Aporte informado">
                <span className="hidden sm:inline">Aporte informado</span>
                <span className="sm:hidden">Informado</span>
              </span>
              <MoneyText
                cents={totalPurchasingCents}
                variant="value"
                className="font-bold text-foreground text-xs sm:text-sm tabular-nums truncate mt-0.5"
              />
            </div>
            <div className="flex flex-col px-1 min-w-0">
              <span
                className="text-[10px] font-medium text-muted-foreground truncate"
                title={
                  completedCount > 0
                    ? `Alocado (${completedCount}/${totalRoutesCount} feitos)`
                    : "Alocado em ativos"
                }
              >
                <span className="hidden sm:inline">
                  {completedCount > 0 ? `Alocado (${completedCount}/${totalRoutesCount})` : "Alocado em ativos"}
                </span>
                <span className="sm:hidden">
                  {completedCount > 0 ? `Alocado (${completedCount})` : "Alocado"}
                </span>
              </span>
              <MoneyText
                cents={numberToCents(effectiveTotalAllocated)}
                tone="portfolio"
                variant="value"
                className="font-bold text-xs sm:text-sm tabular-nums truncate mt-0.5"
              />
            </div>
            <div className="flex flex-col px-1 min-w-0">
              <span className="text-[10px] font-medium text-muted-foreground truncate" title="Sobra para caixa">
                <span className="hidden sm:inline">Sobra para caixa</span>
                <span className="sm:hidden">Sobra Caixa</span>
              </span>
              <MoneyText
                cents={numberToCents(effectiveLeftover)}
                variant="value"
                className="font-bold text-foreground text-xs sm:text-sm tabular-nums truncate mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* Rodapé Compacto: Chips Nef & Maior Ativo + Botão Overflow Ledger */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {/* Chip Nef */}
            {diversificationImpact?.currentNef !== null && diversificationImpact?.currentNef !== undefined ? (
              <div
                className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-muted-foreground border border-border/40"
                title="Número Efetivo de Ativos (Nef) antes e após este aporte"
              >
                <span>Nef:</span>
                <span className="font-semibold text-foreground font-mono tabular-nums">
                  {hasAporte && diversificationImpact.projectedNef !== null ? (
                    <>
                      <span>{diversificationImpact.currentNef.toFixed(1)}</span>
                      <span className="mx-1 text-muted-foreground font-sans">{"->"}</span>
                      <span>{diversificationImpact.projectedNef.toFixed(1)}</span>
                    </>
                  ) : (
                    diversificationImpact.currentNef.toFixed(1)
                  )}
                </span>
                {hasAporte &&
                diversificationImpact.deltaNefPct !== null &&
                diversificationImpact.deltaNefPct !== undefined &&
                diversificationImpact.deltaNefPct !== 0 ? (
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      diversificationImpact.deltaNefPct > 0 ? "text-positive-strong" : "text-muted-foreground",
                    )}
                  >
                    ({diversificationImpact.deltaNefPct > 0 ? "+" : ""}
                    {diversificationImpact.deltaNefPct.toFixed(1)}%)
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Chip Maior Ativo */}
            {diversificationImpact?.currentTopAssetSharePct !== null &&
            diversificationImpact?.currentTopAssetSharePct !== undefined ? (
              <div
                className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-muted-foreground border border-border/40"
                title="Participação da maior posição na carteira"
              >
                <span>Maior:</span>
                <span className="font-semibold text-foreground font-mono tabular-nums">
                  {hasAporte && diversificationImpact.projectedTopAssetSharePct !== null
                    ? `${diversificationImpact.projectedTopAssetSharePct.toFixed(1)}%`
                    : `${diversificationImpact.currentTopAssetSharePct.toFixed(1)}%`}
                </span>
                {hasAporte &&
                diversificationImpact.projectedTopAssetSharePct !== null &&
                diversificationImpact.currentTopAssetSharePct > diversificationImpact.projectedTopAssetSharePct ? (
                  <span className="text-positive-strong font-medium tabular-nums">
                    (-
                    {(
                      diversificationImpact.currentTopAssetSharePct -
                      diversificationImpact.projectedTopAssetSharePct
                    ).toFixed(1)}
                    %)
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Botão Overflow Ledger Ancorado à Direita */}
          {onOpenOverflowLedger ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenOverflowLedger}
              className="text-muted-foreground hover:text-foreground text-[11px] gap-1 h-6 px-1.5 cursor-pointer shrink-0 ml-auto"
            >
              <Sparkles className="size-3 text-primary" aria-hidden="true" />
              <span>Overflow Ledger</span>
              {overflowEventsCount !== undefined && overflowEventsCount > 0 ? (
                <Badge variant="warning" size="xs">
                  {overflowEventsCount}
                </Badge>
              ) : null}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
