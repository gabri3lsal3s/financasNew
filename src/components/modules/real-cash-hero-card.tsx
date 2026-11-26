import { useMemo, useState } from "react";
import { ArrowUpRight, Briefcase, ChevronRight, CreditCard, Gauge, Landmark, Scale, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { MoneyText } from "@/components/ui/money-text";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/services/errors";
import { calculateSafeDailySpending } from "@/domain/cash";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { UseRealCashBalanceResult } from "@/state";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import {
  buildRealCashBreakdown,
  buildSafeDailySpendingBreakdown,
  buildSafeToSpendBreakdown,
} from "@/domain/calculation-memory";
import { CashCheckpointDialog } from "./cash-checkpoint-dialog";
import { CycleObligationsDialog } from "./cycle-obligations-dialog";
import { CalculationMemoryModal } from "./calculation-memory";

export interface RealCashHeroCardProps {
  realCashData: UseRealCashBalanceResult;
  className?: string;
  onCalibrate?: () => void;
}

/**
 * Card mestre de liquidez e saldo bancário real na Visão Geral (§F49).
 *
 * Exibe o saldo cumulativo em contas bancárias, permite calibração rápida
 * em 1 clique ("Bater com o banco") e demonstra o Saldo Livre Real (Safe-to-Spend).
 */
export function RealCashHeroCard({ realCashData, className, onCalibrate }: RealCashHeroCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const { guardAction, upgradeModal } = useMutationGuard();
  const { cashBalance, safeToSpend } = realCashData;

  const handleCalibrate = () => {
    if (onCalibrate) {
      onCalibrate();
    } else {
      guardAction(() => setDialogOpen(true), "Calibrar Saldo com o Banco");
    }
  };

  const latestCheckpoint = cashBalance.latestCheckpoint;
  const hasCheckpoint = latestCheckpoint !== null;
  const hasReceivables = (safeToSpend.receivablePendingCents ?? 0) > 0;

  const realCashBreakdown = useMemo(() => {
    return buildRealCashBreakdown({
      currentBalanceCents: cashBalance.currentBalanceCents,
      latestCheckpoint: cashBalance.latestCheckpoint,
      checkpointBalanceCents: cashBalance.checkpointBalanceCents,
      inflowSinceCheckpointCents: cashBalance.inflowSinceCheckpointCents,
      outflowSinceCheckpointCents: cashBalance.outflowSinceCheckpointCents,
    });
  }, [cashBalance]);

  const nextCycleInvoicesCents =
    realCashData.cycleBreakdown?.nextCycleInvoicesCents ??
    safeToSpend?.nextCycleInvoicesCents ??
    0;
  const nextCycleInvoicesCount = realCashData.cycleBreakdown?.nextCycleInvoices?.length ?? 0;
  const futureInvoicesCents =
    realCashData.cycleBreakdown?.futureInvoicesCents ??
    safeToSpend?.futureInvoicesCents ??
    0;
  const futureInvoicesCount = realCashData.cycleBreakdown?.futureInvoices?.length ?? 0;
  const totalUpcomingCardInvoicesCents = nextCycleInvoicesCents + futureInvoicesCents;

  const effectiveSafeDaily = useMemo(
    () =>
      realCashData.safeDailySpending ??
      calculateSafeDailySpending({
        safeToSpendCents: safeToSpend.safeToSpendCents,
        averageMonthlyIncomeCents: 0,
        nextCycleInvoicesCents,
        futureInvoicesCents,
        nextMonthPayableDebtsCents: realCashData.cycleBreakdown?.nextMonthPayableDebtsCents ?? 0,
      }),
    [
      realCashData.safeDailySpending,
      safeToSpend.safeToSpendCents,
      nextCycleInvoicesCents,
      futureInvoicesCents,
      realCashData.cycleBreakdown?.nextMonthPayableDebtsCents,
    ],
  );

  const safeToSpendBreakdown = useMemo(() => {
    return buildSafeToSpendBreakdown({
      realCashBalanceCents: cashBalance.currentBalanceCents,
      committedObligationsCents: safeToSpend.committedObligationsCents,
      openInvoicesCents: safeToSpend.openInvoicesCents,
      payablePendingCents: safeToSpend.payablePendingCents,
      receivablePendingCents: safeToSpend.receivablePendingCents,
      derivedBusinessCashCents: safeToSpend.derivedBusinessCashCents,
      safeToSpendCents: safeToSpend.safeToSpendCents,
      safeToSpendWithReceivablesCents: safeToSpend.safeToSpendWithReceivablesCents,
      includeReceivablesInTotal: false, // Modo conservador prudencial condizente com a métrica do card
      nextCycleInvoicesCents,
      nextCycleInvoicesCount,
      futureInvoicesCents,
      futureInvoicesCount,
    });
  }, [
    cashBalance.currentBalanceCents,
    safeToSpend,
    nextCycleInvoicesCents,
    nextCycleInvoicesCount,
    futureInvoicesCents,
    futureInvoicesCount,
  ]);

  const safeDailyBreakdown = useMemo(
    () => buildSafeDailySpendingBreakdown(effectiveSafeDaily),
    [effectiveSafeDaily],
  );

  const dailySubtitle = !effectiveSafeDaily.hasIncomeBase
    ? "Aguardando histórico de renda"
    : effectiveSafeDaily.incomeSource === "year_average"
      ? `Base: renda média (${effectiveSafeDaily.incomeMonthsCount} ${effectiveSafeDaily.incomeMonthsCount === 1 ? "mês" : "meses"})`
      : "Base: renda do mês";

  if (realCashData.isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Carregando saldo disponível em conta"
        className={cn(
          "flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>
    );
  }

  if (realCashData.error) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0",
          className,
        )}
      >
        <ErrorState
          message={getErrorMessage(realCashData.error)}
          onRetry={() => void realCashData.refetch()}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all min-w-0",
          className,
        )}
      >
        {/* Topo do Card: Título + Badge + Ação de Calibrar */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Landmark className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-tight text-foreground break-words min-w-0">
              Saldo Disponível em Conta
            </h2>
            <CalculationMemoryModal breakdown={realCashBreakdown} priority="p0" />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Badge variant="muted" size="xs">
              {hasCheckpoint ? `Aferido em ${formatDateBR(latestCheckpoint.date)}` : "Acumulado do Fluxo"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCalibrate}
              aria-label="Calibrar com o banco"
              className="h-7 gap-1 px-2.5 text-xs font-medium text-foreground hover:bg-surface-hover cursor-pointer border-border/80"
            >
              <Scale className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Calibrar</span>
            </Button>
          </div>
        </div>

        {/* Valor Principal em Destaque com Auto-Fit para 7+ e 8+ dígitos */}
        <div className="flex flex-col gap-1.5 pt-0.5 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0 overflow-x-auto no-scrollbar">
            <MoneyText
              cents={cashBalance.currentBalanceCents}
              tone={cashBalance.currentBalanceCents >= 0 ? "default" : "negative"}
              variant="hero"
              animated
              className={cn(
                "font-bold tracking-tight whitespace-nowrap",
                Math.abs(cashBalance.currentBalanceCents) >= 100_000_000
                  ? "text-xl sm:text-2xl"
                  : Math.abs(cashBalance.currentBalanceCents) >= 10_000_000
                    ? "text-2xl sm:text-3xl"
                    : "text-2xl sm:text-3xl",
              )}
            />
          </div>

          {(realCashData.businessCashBreakdown?.hasBusinessCash || hasReceivables) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
              {realCashData.businessCashBreakdown?.hasBusinessCash && (
                <>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Pessoal:</span>
                    <MoneyText
                      cents={realCashData.businessCashBreakdown.personalCashCents}
                      tone="default"
                      className="font-medium text-foreground tabular-nums"
                    />
                  </div>
                  <span className="text-border" aria-hidden="true">·</span>
                  <div className="flex items-center gap-1.5 font-medium text-portfolio">
                    <Briefcase className="size-3.5 text-portfolio" aria-hidden="true" />
                    <span>Meu Negócio:</span>
                    <MoneyText
                      cents={realCashData.businessCashBreakdown.businessCashCents}
                      tone="default"
                      className="font-medium text-portfolio tabular-nums"
                    />
                  </div>
                </>
              )}
              {realCashData.businessCashBreakdown?.hasBusinessCash && hasReceivables && (
                <span className="text-border" aria-hidden="true">·</span>
              )}
              {hasReceivables && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUpRight className="size-3.5 shrink-0 text-positive" aria-hidden="true" />
                  <span>A receber previsto:</span>
                  <MoneyText
                    cents={safeToSpend.receivablePendingCents}
                    tone="positive"
                    animated
                    className="font-medium tabular-nums"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grade Simétrica 1x3: Sobra do Ciclo | Próximas Faturas | Gasto Diário Seguro */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/80 rounded-xl bg-surface-hover/50 border border-border/80 overflow-hidden text-xs">
          {/* Coluna 1: Sobra do Ciclo Atual + Vence este mês */}
          <div className="flex flex-col justify-between gap-1.5 p-3 min-w-0">
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-medium">Sobra do Ciclo</span>
              </div>
              <CalculationMemoryModal breakdown={safeToSpendBreakdown} priority="p0" />
            </div>

            <MoneyText
              cents={safeToSpend.safeToSpendCents}
              tone={safeToSpend.safeToSpendCents >= 0 ? "positive" : "negative"}
              deemphasizeCents
              animated
              className="font-semibold text-sm sm:text-base tracking-tight"
            />

            <button
              type="button"
              onClick={() => setBreakdownOpen(true)}
              className="flex items-center justify-between gap-1.5 -mx-1 px-1 py-0.5 rounded-md hover:bg-surface/80 active:bg-surface transition-colors cursor-pointer text-left text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group min-w-0"
              aria-label="Ver detalhamento das faturas e contas a pagar do ciclo"
              title="Clique para ver o detalhamento das obrigações do ciclo"
            >
              <span className="truncate">
                Vence este mês:{" "}
                <MoneyText
                  cents={safeToSpend.committedObligationsCents}
                  tone={safeToSpend.committedObligationsCents > 0 ? "negative" : "default"}
                  className="text-[11px] font-medium"
                />
              </span>
              <ChevronRight className="size-3 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" aria-hidden="true" />
            </button>
          </div>

          {/* Coluna 2: Próximas Faturas em Acumulação + Faturas Futuras */}
          <button
            type="button"
            onClick={() => setBreakdownOpen(true)}
            className="flex flex-col justify-between gap-1.5 p-3 min-w-0 text-left hover:bg-surface/80 active:bg-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group"
            aria-label="Ver próximas faturas de cartão em acumulação e faturas futuras"
          >
            <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
              <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors min-w-0">
                <CreditCard className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-medium">Próximas Faturas</span>
              </div>
              <ChevronRight className="size-3 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" aria-hidden="true" />
            </div>

            <MoneyText
              cents={nextCycleInvoicesCents > 0 ? nextCycleInvoicesCents : totalUpcomingCardInvoicesCents}
              tone="default"
              deemphasizeCents
              animated
              className="font-semibold text-sm sm:text-base tracking-tight text-foreground"
            />

            <span className="text-[11px] text-muted-foreground truncate w-full">
              {nextCycleInvoicesCents > 0 && futureInvoicesCents > 0 ? (
                <>
                  +{" "}
                  <MoneyText
                    cents={futureInvoicesCents}
                    tone="default"
                    className="text-[11px] font-medium text-muted-foreground"
                  />{" "}
                  futuras
                </>
              ) : totalUpcomingCardInvoicesCents > 0 ? (
                "Em acumulação no cartão"
              ) : (
                "Nenhuma fatura acumulada"
              )}
            </span>
          </button>

          {/* Coluna 3: Gasto Diário Seguro */}
          <div className="flex flex-col justify-between gap-1.5 p-3 min-w-0">
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                <Gauge className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-medium">Gasto Diário Seguro</span>
              </div>
              <CalculationMemoryModal breakdown={safeDailyBreakdown} priority="p0" />
            </div>

            {effectiveSafeDaily.hasIncomeBase && effectiveSafeDaily.safeDailyCents !== null ? (
              <div className="flex items-baseline gap-1 min-w-0">
                <MoneyText
                  cents={effectiveSafeDaily.safeDailyCents}
                  tone={effectiveSafeDaily.safeDailyCents > 0 ? "positive" : "negative"}
                  deemphasizeCents
                  animated
                  className="font-semibold text-sm sm:text-base tracking-tight"
                />
                <span className="text-[11px] text-muted-foreground">/dia</span>
              </div>
            ) : (
              <span className="font-semibold text-sm sm:text-base text-muted-foreground">—</span>
            )}

            <span className="text-[11px] text-muted-foreground truncate">{dailySubtitle}</span>
          </div>
        </div>
      </div>

      <CycleObligationsDialog
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        breakdown={realCashData.cycleBreakdown}
      />

      {!onCalibrate && (
        <CashCheckpointDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          currentBalanceCents={cashBalance.currentBalanceCents}
        />
      )}

      {!onCalibrate && upgradeModal}
    </>
  );
}
