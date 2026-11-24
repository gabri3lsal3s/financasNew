import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Briefcase, ChevronRight, CreditCard, Landmark, Scale, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { UseRealCashBalanceResult } from "@/state";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import {
  buildFreeToSpendBreakdown,
  buildRealCashBreakdown,
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
  const freeToSpendCents =
    safeToSpend.freeToSpendCents ??
    Math.max(0, safeToSpend.safeToSpendCents - nextCycleInvoicesCents);

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

  const freeToSpendBreakdown = useMemo(() => {
    return buildFreeToSpendBreakdown({
      safeToSpendCents: safeToSpend.safeToSpendCents,
      nextCycleInvoicesCents,
      nextCycleInvoicesCount,
      futureInvoicesCents,
      futureInvoicesCount,
      freeToSpendCents,
    });
  }, [
    safeToSpend.safeToSpendCents,
    nextCycleInvoicesCents,
    nextCycleInvoicesCount,
    futureInvoicesCents,
    futureInvoicesCount,
    freeToSpendCents,
  ]);

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
            <CalculationMemoryModal breakdown={realCashBreakdown} />
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

          {realCashData.businessCashBreakdown?.hasBusinessCash && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
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
            </div>
          )}
        </div>

        {/* Linha de Projeção Safe-to-Spend */}
        <div
          className={cn(
            "grid grid-cols-1 gap-2.5 rounded-xl bg-surface-hover/50 border border-border/80 p-2.5 sm:p-3 text-xs",
            hasReceivables ? "sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          <button
            type="button"
            onClick={() => setBreakdownOpen(true)}
            className="flex items-center justify-between sm:justify-start gap-2 min-w-0 min-h-11 sm:min-h-0 -m-1 p-1 rounded-lg hover:bg-surface/80 active:bg-surface transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group"
            aria-label="Ver detalhamento das faturas e contas a pagar do ciclo"
            title="Clique para ver o detalhamento das obrigações do ciclo"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors min-w-0">
              <ArrowDownRight className="size-3.5 shrink-0 text-negative" aria-hidden="true" />
              <span className="truncate hidden sm:inline">Faturas e contas a pagar do ciclo (bruto):</span>
              <span className="truncate sm:hidden">Obrigações do ciclo:</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <MoneyText
                cents={safeToSpend.committedObligationsCents}
                tone="negative"
                animated
                className="font-medium shrink-0 group-hover:underline decoration-negative/40 underline-offset-2"
              />
              <ChevronRight className="size-3 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" aria-hidden="true" />
            </div>
          </button>

          {hasReceivables && (
            <div className="flex items-center justify-between sm:justify-end lg:justify-center gap-2 pt-1.5 sm:pt-0 border-t border-border/80 sm:border-t-0 min-w-0">
              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                <ArrowUpRight className="size-3.5 shrink-0 text-positive" aria-hidden="true" />
                <span className="truncate hidden sm:inline">A receber previsto:</span>
                <span className="truncate sm:hidden">A receber:</span>
              </div>
              <MoneyText
                cents={safeToSpend.receivablePendingCents}
                tone="positive"
                animated
                className="font-medium shrink-0"
              />
            </div>
          )}

          <div
            className={cn(
              "flex items-center justify-between gap-2 pt-1.5 sm:pt-0 border-t border-border/80 sm:border-t-0 min-w-0",
              hasReceivables
                ? "sm:col-span-2 sm:border-t sm:pt-2 sm:justify-between lg:col-span-1 lg:border-t-0 lg:pt-0 lg:justify-end"
                : "sm:justify-end",
            )}
          >
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate text-muted-foreground">Saldo Livre Real:</span>
              <CalculationMemoryModal breakdown={safeToSpendBreakdown} priority="p0" />
            </div>
            <MoneyText
              cents={safeToSpend.safeToSpendCents}
              tone={safeToSpend.safeToSpendCents >= 0 ? "positive" : "negative"}
              deemphasizeCents
              animated
              className="font-semibold text-xs sm:text-sm shrink-0"
            />
          </div>

          {totalUpcomingCardInvoicesCents > 0 ? (
            <div className="col-span-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/80 min-w-0">
              <button
                type="button"
                onClick={() => setBreakdownOpen(true)}
                className="flex items-center justify-between sm:justify-start gap-2 min-w-0 -m-1 p-1 rounded-lg hover:bg-surface/80 active:bg-surface transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group"
                aria-label="Ver próximas faturas de cartão em acumulação e faturas futuras"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors min-w-0">
                  <CreditCard className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">Próximas faturas:</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <MoneyText
                    cents={nextCycleInvoicesCents > 0 ? nextCycleInvoicesCents : totalUpcomingCardInvoicesCents}
                    tone="default"
                    className="font-medium text-foreground shrink-0 group-hover:underline decoration-border underline-offset-2"
                  />
                  {nextCycleInvoicesCents > 0 && futureInvoicesCents > 0 ? (
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      (+{" "}
                      <MoneyText
                        cents={futureInvoicesCents}
                        tone="default"
                        className="text-[11px] font-medium text-muted-foreground"
                      />{" "}
                      futuras)
                    </span>
                  ) : null}
                  <ChevronRight className="size-3 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" aria-hidden="true" />
                </div>
              </button>

              <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t border-border/80 sm:border-t-0 min-w-0">
                <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  <span className="truncate text-muted-foreground">Livre para gastar:</span>
                  <CalculationMemoryModal breakdown={freeToSpendBreakdown} priority="p1" />
                </div>
                <MoneyText
                  cents={freeToSpendCents}
                  tone={freeToSpendCents > 0 ? "positive" : "default"}
                  deemphasizeCents
                  animated
                  className="font-semibold text-xs sm:text-sm shrink-0"
                />
              </div>
            </div>
          ) : null}
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
