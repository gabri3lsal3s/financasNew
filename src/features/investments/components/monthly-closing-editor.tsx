import { useState, useMemo } from "react";
import { Check, RefreshCw, Layers, ShieldCheck, Wallet, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { useSaveMonthlyClosing } from "@/state/mutations/use-portfolio-monthly-mutations";
import type { PointInTimeResult } from "@/domain/portfolio";
import type { MonthlyPriceInput, MonthlyPriceSource } from "@/types";
import { cn } from "@/lib/utils";

export interface MonthlyClosingEditorProps {
  month: string;
  historicalPosition: PointInTimeResult;
  onSaved?: () => void;
  className?: string;
}

interface EditableItemState {
  ticker: string;
  assetClass: string;
  currency: "BRL" | "USD";
  quantity: number;
  priceCents: number;
  source: MonthlyPriceSource;
  isCandidate: boolean;
  currentPrice: number;
  fxRate: number;
}

function buildInitialItemsState(
  historicalPosition: PointInTimeResult,
): Record<string, EditableItemState> {
  const initial: Record<string, EditableItemState> = {};

  // 1. Posições apuradas deterministicamente via transações até a data de corte
  for (const pos of historicalPosition.positions) {
    const isUsd = pos.currency === "USD";
    const fxRate = isUsd && pos.priceQuote > 0 ? pos.priceBRL / pos.priceQuote : 1;

    initial[pos.ticker] = {
      ticker: pos.ticker,
      assetClass: pos.assetClass ?? "Outros",
      currency: (pos.currency as "BRL" | "USD") ?? "BRL",
      quantity: pos.quantity,
      priceCents: Math.round((pos.priceQuote ?? pos.priceBRL) * 100),
      source: (pos.quoteSource as MonthlyPriceSource) ?? (pos.isEstimate ? "fallback" : "api"),
      isCandidate: false,
      currentPrice: pos.priceQuote ?? pos.priceBRL,
      fxRate,
    };
  }

  // 2. Se a competência possui apenas saldo TWA ou faltam ativos apurados, carrega os candidatos da carteira
  const isBalanceOnly =
    historicalPosition.fidelity?.status === "balance_only" ||
    historicalPosition.positions.length === 0;

  if (isBalanceOnly && historicalPosition.candidateAssets) {
    for (const cand of historicalPosition.candidateAssets) {
      if (!initial[cand.ticker]) {
        initial[cand.ticker] = {
          ticker: cand.ticker,
          assetClass: cand.assetClass,
          currency: cand.currency,
          quantity: cand.suggestedQuantity,
          priceCents: Math.round(cand.referencePrice * 100),
          source: "fallback",
          isCandidate: true,
          currentPrice: cand.referencePrice,
          fxRate: cand.currency === "USD" ? 5.25 : 1,
        };
      }
    }
  }

  return initial;
}

export function MonthlyClosingEditor({
  month,
  historicalPosition,
  onSaved,
  className,
}: MonthlyClosingEditorProps) {
  const saveClosingMutation = useSaveMonthlyClosing();

  // Estado local para ativos e cotacoes editaveis
  const [itemsState, setItemsState] = useState<Record<string, EditableItemState>>(() =>
    buildInitialItemsState(historicalPosition),
  );

  // Estado local de caixa
  const [cashBalanceCents, setCashBalanceCents] = useState<number>(() => {
    return Math.round(historicalPosition.cashQuantity * 100);
  });

  const handleReset = () => {
    setItemsState(buildInitialItemsState(historicalPosition));
    setCashBalanceCents(Math.round(historicalPosition.cashQuantity * 100));
  };

  const handlePriceChange = (ticker: string, cents: number) => {
    setItemsState((prev) => {
      const item = prev[ticker];
      if (!item) return prev;
      return {
        ...prev,
        [ticker]: {
          ...item,
          priceCents: Math.max(0, cents),
          source: "manual",
        },
      };
    });
  };

  const handleQuantityChange = (ticker: string, rawVal: string) => {
    const num = Number.parseFloat(rawVal.replace(",", "."));
    const qty = Number.isNaN(num) ? 0 : Math.max(0, num);
    setItemsState((prev) => {
      const item = prev[ticker];
      if (!item) return prev;
      return {
        ...prev,
        [ticker]: {
          ...item,
          quantity: qty,
        },
      };
    });
  };

  // Calculo do patrimonio recalculado em tempo real
  const recalculatedSummary = useMemo(() => {
    const itemsList = Object.values(itemsState).map((item) => {
      const unitPrice = item.priceCents / 100;
      const valueBRL = Math.round(item.quantity * unitPrice * item.fxRate * 100) / 100;
      const currentPrice = item.currentPrice;
      const diffPct =
        unitPrice > 0 && currentPrice > 0
          ? ((currentPrice - unitPrice) / unitPrice) * 100
          : null;

      return {
        ...item,
        editedPrice: unitPrice,
        editedValueBRL: valueBRL,
        diffPct,
      };
    });

    const totalInvestedBRL = itemsList.reduce((acc, it) => acc + it.editedValueBRL, 0);
    const cashBRL = cashBalanceCents / 100;
    const totalValueBRL = Math.round((totalInvestedBRL + cashBRL) * 100) / 100;
    const assetsCostBRL =
      historicalPosition.totalCostBRL > 0
        ? historicalPosition.totalCostBRL
        : totalInvestedBRL;
    // Regra canônica (§2.1 / §2.2 PLANO_AUDITORIA): Custo dos Ativos + Saldo de Caixa (paridade 1:1)
    const totalCostBRL = Math.round((assetsCostBRL + cashBRL) * 100) / 100;
    const gainBRL = Math.round((totalValueBRL - totalCostBRL) * 100) / 100;
    const gainPct = totalCostBRL > 0 ? (gainBRL / totalCostBRL) * 100 : 0;

    const snapshotTargetValue = historicalPosition.fidelity?.snapshotTotalValue ?? null;
    const discrepancyBRL =
      snapshotTargetValue !== null
        ? Math.round((totalValueBRL - snapshotTargetValue) * 100) / 100
        : null;

    return {
      items: itemsList,
      totalInvestedBRL,
      cashBRL,
      totalValueBRL,
      totalCostBRL,
      gainBRL,
      gainPct,
      snapshotTargetValue,
      discrepancyBRL,
    };
  }, [itemsState, cashBalanceCents, historicalPosition]);

  const handleSave = async () => {
    const validItems = recalculatedSummary.items.filter((item) => item.editedPrice > 0);

    const pricesPayload: MonthlyPriceInput[] = validItems.map((item) => ({
      ticker: item.ticker,
      month,
      price: item.editedPrice,
      currency: (item.currency as "BRL" | "USD") ?? "BRL",
      source: item.source,
    }));

    await saveClosingMutation.mutateAsync({
      month,
      prices: pricesPayload,
      totalValueBRL: recalculatedSummary.totalValueBRL,
      totalCostBRL: recalculatedSummary.totalCostBRL,
    });

    if (onSaved) {
      onSaved();
    }
  };

  const getSourceBadge = (source: MonthlyPriceSource, isEstimate?: boolean) => {
    if (source === "manual") {
      return (
        <Badge variant="default" size="xs" className="font-semibold">
          Manual
        </Badge>
      );
    }
    if (source === "api" && !isEstimate) {
      return (
        <Badge variant="positive" size="xs" className="font-semibold">
          Oficial API
        </Badge>
      );
    }
    return (
      <Badge variant="muted" size="xs" className="font-semibold text-muted-foreground">
        Sugerida
      </Badge>
    );
  };

  return (
    <div className={cn("flex flex-col gap-4 w-full", className)}>
      {/* Aviso de Calibração quando a competência possuía apenas saldo TWA */}
      {historicalPosition.fidelity?.status === "balance_only" && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-semibold text-foreground">
              Competência registrada apenas com saldo consolidado (TWA)
            </span>
            <p className="text-muted-foreground leading-relaxed m-0 text-[11px]">
              O saldo registrado no histórico de rentabilidade para este mês é de{" "}
              <strong>
                <MoneyText
                  cents={numberToCents(historicalPosition.fidelity.snapshotTotalValue ?? 0)}
                  tone="portfolio"
                  className="inline font-bold"
                />
              </strong>
              . Carregamos os ativos da sua carteira abaixo para você calibrar o que possuía naquele mês. Ajuste as quantidades, cotações e saldo de caixa e clique em{" "}
              <strong>Salvar Fechamento & Gerar Relatório</strong> para oficializar a custódia auditada.
            </p>
          </div>
        </div>
      )}

      {/* Banner Informativo & Ação de Salvamento */}
      <div className="rounded-xl border border-border/80 bg-surface/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="size-4 text-portfolio shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Conferência e Calibração do Fechamento ({month})
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
              Revise e calibre as quantidades e cotações de fechamento dos ativos para auditar este mês. Ao salvar, os dados serão consolidados e o Relatório Executivo A4 será gerado de forma oficial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={saveClosingMutation.isPending}
            size="sm"
            className="gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Restaurar Valores</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saveClosingMutation.isPending}
            size="sm"
            className="gap-1.5 cursor-pointer font-semibold"
          >
            {saveClosingMutation.isPending ? (
              <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" aria-hidden="true" />
            )}
            <span>Salvar Fechamento & Gerar Relatório</span>
          </Button>
        </div>
      </div>

      {/* Régua de Reconciliação com o Saldo TWA em Tempo Real */}
      {recalculatedSummary.snapshotTargetValue !== null && (
        <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Saldo Registrado no TWA
              </span>
              <MoneyText
                cents={numberToCents(recalculatedSummary.snapshotTargetValue)}
                tone="portfolio"
                className="text-sm sm:text-base font-bold tabular-nums"
              />
            </div>
            <span className="text-border text-lg font-light" aria-hidden="true">vs</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Patrimônio Calibrado (Ativos + Caixa)
              </span>
              <MoneyText
                cents={numberToCents(recalculatedSummary.totalValueBRL)}
                tone={
                  Math.abs(recalculatedSummary.discrepancyBRL ?? 0) < 1
                    ? "positive"
                    : "default"
                }
                className={
                  Math.abs(recalculatedSummary.discrepancyBRL ?? 0) < 1
                    ? "text-sm sm:text-base font-bold tabular-nums"
                    : "text-warning-strong text-sm sm:text-base font-bold tabular-nums"
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {Math.abs(recalculatedSummary.discrepancyBRL ?? 0) < 1 ? (
              <Badge variant="positive" size="sm" className="font-semibold">
                100% Alinhado ao Saldo TWA
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" className="font-semibold">
                {recalculatedSummary.discrepancyBRL && recalculatedSummary.discrepancyBRL > 0 ? "+" : ""}
                <MoneyText cents={numberToCents(recalculatedSummary.discrepancyBRL ?? 0)} /> vs TWA
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Card de Resumo Recalculado em Tempo Real */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1 shadow-2xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Patrimônio Recalculado
          </span>
          <MoneyText
            cents={numberToCents(recalculatedSummary.totalValueBRL)}
            tone="portfolio"
            className="text-base sm:text-lg font-bold tabular-nums"
          />
          <span className="text-[10.5px] text-muted-foreground">
            {recalculatedSummary.items.filter((i) => i.quantity > 0).length} ativos com custódia
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1 shadow-2xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Custo Total Histórico
          </span>
          <MoneyText
            cents={numberToCents(recalculatedSummary.totalCostBRL)}
            tone="default"
            className="text-base sm:text-lg font-bold tabular-nums"
          />
          <span className="text-[10.5px] text-muted-foreground">
            Custo apurado até {month}
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1 shadow-2xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Resultado Contábil
          </span>
          <span
            className={cn(
              "text-base sm:text-lg font-bold font-mono tabular-nums",
              recalculatedSummary.gainBRL >= 0 ? "text-positive-strong" : "text-negative-strong",
            )}
          >
            <MoneyText
              cents={numberToCents(recalculatedSummary.gainBRL)}
              tone={recalculatedSummary.gainBRL >= 0 ? "positive" : "negative"}
              sign="explicit"
            />
          </span>
          <span className="text-[10.5px] font-mono text-muted-foreground">
            {formatSignedPct(recalculatedSummary.gainPct)} sobre o custo
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col gap-1.5 shadow-2xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Wallet className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Saldo de Caixa</span>
          </span>
          <div className="w-full">
            <MoneyInput
              cents={cashBalanceCents}
              onCentsChange={setCashBalanceCents}
              size="sm"
              className="h-8 text-xs font-mono font-bold"
            />
          </div>
          <span className="text-[10px] text-muted-foreground truncate">
            Liquidez livre no mês
          </span>
        </div>
      </div>

      {/* Tabela de Custódia e Edição de Cotações */}
      <div className="rounded-xl border border-border/80 bg-surface overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-portfolio" aria-hidden="true" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Ativos em Custódia no Fechamento
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            {recalculatedSummary.items.length} ativos listados
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                <th className="py-2 px-3">Ativo / Classe</th>
                <th className="py-2 px-2.5 text-right w-28">Qtd. Fechamento</th>
                <th className="py-2 px-2.5 text-right w-36">Cotação Fechamento</th>
                <th className="py-2 px-2 text-center">Origem</th>
                <th className="py-2 px-2.5 text-right">Cotação Ref.</th>
                <th className="py-2 px-2 text-right">Dif. (%)</th>
                <th className="py-2 px-3 text-right">Total Fechamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recalculatedSummary.items.map((item) => {
                return (
                  <tr key={item.ticker} className="even:bg-muted/15 hover:bg-surface-hover/40 transition-colors">
                    {/* Ticker + Classe */}
                    <td className="py-2 px-3 min-w-[140px]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground text-xs">{item.ticker}</span>
                          {item.isCandidate && (
                            <Badge variant="muted" size="xs">
                              Sugerido
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {item.assetClass}
                        </span>
                      </div>
                    </td>

                    {/* Quantidade Histórica (Editável para Calibração) */}
                    <td className="py-1.5 px-2.5 text-right">
                      <div className="w-24 ml-auto">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.ticker, e.target.value)}
                          className="h-7 text-xs font-mono font-bold text-right px-2"
                        />
                      </div>
                    </td>

                    {/* Cotação de Fechamento (Editável com MoneyInput) */}
                    <td className="py-1.5 px-2.5 text-right">
                      <div className="w-32 ml-auto">
                        <MoneyInput
                          cents={item.priceCents}
                          onCentsChange={(c) => handlePriceChange(item.ticker, c)}
                          size="sm"
                          currency={item.currency}
                          className="h-7 text-xs font-mono font-bold text-right"
                        />
                      </div>
                    </td>

                    {/* Badge de Origem */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      {getSourceBadge(item.source, item.isCandidate)}
                    </td>

                    {/* Cotação Atual/Referência */}
                    <td className="py-2 px-2.5 text-right font-mono text-muted-foreground text-xs">
                      <MoneyText
                        cents={numberToCents(item.currentPrice)}
                        currency={item.currency}
                      />
                    </td>

                    {/* Variação Percentual desde o Fechamento */}
                    <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">
                      {item.diffPct !== null ? (
                        <span
                          className={cn(
                            "font-semibold",
                            item.diffPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                          )}
                        >
                          {item.diffPct >= 0 ? "+" : ""}
                          {formatPercent(item.diffPct)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Total Consolidado */}
                    <td className="py-2 px-3 text-right font-mono font-bold text-foreground text-xs">
                      <MoneyText cents={numberToCents(item.editedValueBRL)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
