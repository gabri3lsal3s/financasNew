import { useState, useMemo } from "react";
import { Check, RefreshCw, Layers, ShieldCheck, Wallet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { useSaveMonthlyClosing } from "@/state/mutations/use-portfolio-monthly-mutations";
import type { PointInTimeAssetPosition, PointInTimeResult } from "@/domain/portfolio";
import type { MonthlyPriceInput, MonthlyPriceSource } from "@/types";
import { cn } from "@/lib/utils";

export interface MonthlyClosingEditorProps {
  month: string;
  historicalPosition: PointInTimeResult;
  onSaved?: () => void;
  className?: string;
}

interface EditableQuoteState {
  ticker: string;
  priceCents: number;
  source: MonthlyPriceSource;
}

export function MonthlyClosingEditor({
  month,
  historicalPosition,
  onSaved,
  className,
}: MonthlyClosingEditorProps) {
  const saveClosingMutation = useSaveMonthlyClosing();

  // Estado local para cotacoes editaveis por ticker
  const [quotesState, setQuotesState] = useState<Record<string, EditableQuoteState>>(() => {
    const initial: Record<string, EditableQuoteState> = {};
    for (const pos of historicalPosition.positions) {
      initial[pos.ticker] = {
        ticker: pos.ticker,
        priceCents: Math.round((pos.priceQuote ?? pos.priceBRL) * 100),
        source: (pos.quoteSource as MonthlyPriceSource) ?? (pos.isEstimate ? "fallback" : "api"),
      };
    }
    return initial;
  });

  // Estado local de caixa
  const [cashBalanceCents, setCashBalanceCents] = useState<number>(() => {
    return Math.round(historicalPosition.cashQuantity * 100);
  });

  const handlePriceChange = (ticker: string, cents: number) => {
    setQuotesState((prev) => ({
      ...prev,
      [ticker]: {
        ticker,
        priceCents: Math.max(0, cents),
        source: "manual",
      },
    }));
  };

  // Calculo do patrimonio recalculado em tempo real
  const recalculatedSummary = useMemo(() => {
    const items = historicalPosition.positions.map((pos) => {
      const qState = quotesState[pos.ticker];
      const unitPrice = qState ? qState.priceCents / 100 : pos.priceQuote ?? pos.priceBRL;
      const isUsd = pos.currency === "USD";
      const fxRate = isUsd && pos.priceQuote > 0 ? pos.priceBRL / pos.priceQuote : 1;
      const valueBRL = Math.round(pos.quantity * unitPrice * fxRate * 100) / 100;

      // Comparacao com cotacao atual (hoje)
      const currentPrice = isUsd ? (pos.priceQuote ?? pos.priceBRL) : pos.priceBRL;
      const diffPct =
        unitPrice > 0 && currentPrice > 0
          ? ((currentPrice - unitPrice) / unitPrice) * 100
          : null;

      return {
        ...pos,
        editedPrice: unitPrice,
        editedValueBRL: valueBRL,
        source: qState?.source ?? (pos.isEstimate ? "fallback" : "api"),
        currentPrice,
        diffPct,
      };
    });

    const totalInvestedBRL = items.reduce((acc, it) => acc + it.editedValueBRL, 0);
    const cashBRL = cashBalanceCents / 100;
    const totalValueBRL = Math.round((totalInvestedBRL + cashBRL) * 100) / 100;
    const totalCostBRL = historicalPosition.totalCostBRL;
    const gainBRL = Math.round((totalValueBRL - totalCostBRL) * 100) / 100;
    const gainPct = totalCostBRL > 0 ? (gainBRL / totalCostBRL) * 100 : 0;

    return {
      items,
      totalInvestedBRL,
      cashBRL,
      totalValueBRL,
      totalCostBRL,
      gainBRL,
      gainPct,
    };
  }, [historicalPosition, quotesState, cashBalanceCents]);

  const handleSave = async () => {
    const pricesPayload: MonthlyPriceInput[] = recalculatedSummary.items.map((item) => ({
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
              . Revise as cotações e quantidades dos seus ativos abaixo e clique em{" "}
              <strong>Salvar Fechamento & Gerar Relatório</strong> para arquivar a custódia auditada e liberar a visualização oficial do Relatório Executivo A4.
            </p>
          </div>
        </div>
      )}

      {/* Banner Informativo */}
      <div className="rounded-xl border border-border/80 bg-surface/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="size-4 text-portfolio shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Conferência e Ajuste das Cotações de Fechamento ({month})
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
              As quantidades sob custódia são derivadas deterministicamente das suas movimentações até o fechamento daquele mês. Você pode ajustar as cotações de fechamento ou o saldo em caixa livre antes de emitir o relatório oficial.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={saveClosingMutation.isPending}
          size="sm"
          className="shrink-0 gap-1.5 cursor-pointer font-semibold"
        >
          {saveClosingMutation.isPending ? (
            <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-3.5" aria-hidden="true" />
          )}
          <span>Salvar Fechamento & Gerar Relatório</span>
        </Button>
      </div>

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
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span>{recalculatedSummary.items.length} ativos</span>
            {historicalPosition.fidelity?.snapshotTotalValue ? (
              <>
                <span className="text-border" aria-hidden="true">•</span>
                <span
                  className={cn(
                    "font-semibold",
                    Math.abs(recalculatedSummary.totalValueBRL - historicalPosition.fidelity.snapshotTotalValue) < 1
                      ? "text-positive-strong"
                      : "text-warning-strong",
                  )}
                  title="Comparação com o Saldo Registrado no Marco Zero (TWA)"
                >
                  {Math.abs(recalculatedSummary.totalValueBRL - historicalPosition.fidelity.snapshotTotalValue) < 1
                    ? "Alinhado ao TWA"
                    : `${recalculatedSummary.totalValueBRL >= historicalPosition.fidelity.snapshotTotalValue ? "+" : ""}${(((recalculatedSummary.totalValueBRL - historicalPosition.fidelity.snapshotTotalValue) / historicalPosition.fidelity.snapshotTotalValue) * 100).toFixed(1)}% vs TWA`}
                </span>
              </>
            ) : null}
          </div>
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
            Aportes até {month}
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
            {recalculatedSummary.items.length} ativos apurados
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                <th className="py-2 px-3">Ativo / Classe</th>
                <th className="py-2 px-2.5 text-right">Qtd. Histórica</th>
                <th className="py-2 px-2.5 text-right w-36">Cotação Fechamento</th>
                <th className="py-2 px-2 text-center">Origem</th>
                <th className="py-2 px-2.5 text-right">Cotação Atual</th>
                <th className="py-2 px-2 text-right">Dif. (%)</th>
                <th className="py-2 px-3 text-right">Total Fechamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recalculatedSummary.items.map((item: PointInTimeAssetPosition & { editedPrice: number; editedValueBRL: number; source: MonthlyPriceSource; currentPrice: number; diffPct: number | null }) => {
                const qState = quotesState[item.ticker];
                const centsVal = qState ? qState.priceCents : Math.round(item.editedPrice * 100);

                return (
                  <tr key={item.ticker} className="even:bg-muted/15 hover:bg-surface-hover/40 transition-colors">
                    {/* Ticker + Classe */}
                    <td className="py-2 px-3 min-w-[130px]">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-xs">{item.ticker}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {item.assetClass}
                        </span>
                      </div>
                    </td>

                    {/* Quantidade Histórica (Leitura Apenas) */}
                    <td className="py-2 px-2.5 text-right font-mono font-semibold text-foreground text-xs">
                      {item.quantity.toLocaleString("pt-BR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 4,
                      })}
                    </td>

                    {/* Cotação de Fechamento (Editável com MoneyInput) */}
                    <td className="py-1.5 px-2.5 text-right">
                      <div className="w-32 ml-auto">
                        <MoneyInput
                          cents={centsVal}
                          onCentsChange={(c) => handlePriceChange(item.ticker, c)}
                          size="sm"
                          currency={item.currency as "BRL" | "USD"}
                          className="h-7 text-xs font-mono font-bold text-right"
                        />
                      </div>
                    </td>

                    {/* Badge de Origem */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      {getSourceBadge(item.source, item.isEstimate)}
                    </td>

                    {/* Cotação Atual (Hoje) */}
                    <td className="py-2 px-2.5 text-right font-mono text-muted-foreground text-xs">
                      <MoneyText
                        cents={numberToCents(item.currentPrice)}
                        currency={item.currency as "BRL" | "USD"}
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
