import { useState } from "react";
import { Landmark, Scale, ShieldCheck, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { UseRealCashBalanceResult } from "@/state";
import { CashCheckpointDialog } from "./cash-checkpoint-dialog";

export interface RealCashHeroCardProps {
  realCashData: UseRealCashBalanceResult;
  className?: string;
}

/**
 * Card mestre de liquidez e saldo bancário real na Visão Geral (§F49).
 *
 * Exibe o saldo cumulativo em contas bancárias, permite calibração rápida
 * em 1 clique ("Bater com o banco") e demonstra o Saldo Livre Real (Safe-to-Spend).
 */
export function RealCashHeroCard({ realCashData, className }: RealCashHeroCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { cashBalance, safeToSpend } = realCashData;

  const latestCheckpoint = cashBalance.latestCheckpoint;
  const hasCheckpoint = latestCheckpoint !== null;

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0",
          className,
        )}
      >
        {/* Topo do Card: Título + Badge + Ação de Calibrar */}
        <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <Landmark className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">
              Saldo Disponível em Conta
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Badge variant="muted" size="xs">
              {hasCheckpoint ? `Aferido em ${formatDateBR(latestCheckpoint.date)}` : "Acumulado do Fluxo"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              aria-label="Calibrar com o banco"
              className="h-7 gap-1 px-2.5 text-xs font-medium text-foreground hover:bg-surface-hover cursor-pointer border-border/80"
            >
              <Scale className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Calibrar</span>
            </Button>
          </div>
        </div>

        {/* Valor Principal em Destaque */}
        <div className="flex items-baseline gap-2 pt-0.5">
          <MoneyText
            cents={cashBalance.currentBalanceCents}
            tone={cashBalance.currentBalanceCents >= 0 ? "default" : "negative"}
            animated
            className="text-2xl sm:text-3xl font-bold tracking-tight"
          />
        </div>

        {/* Linha de Projeção Safe-to-Spend */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl bg-surface-hover/50 border border-border/60 p-2.5 sm:p-3 text-xs">
          <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <ArrowDownRight className="size-3.5 shrink-0 text-negative" aria-hidden="true" />
              <span className="truncate hidden sm:inline">Faturas e contas a pagar do ciclo (bruto):</span>
              <span className="truncate sm:hidden">Obrigações do ciclo:</span>
            </div>
            <MoneyText
              cents={safeToSpend.committedObligationsCents}
              tone="negative"
              animated
              className="font-medium shrink-0"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1.5 sm:pt-0 border-t border-border/40 sm:border-t-0 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
              <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate text-muted-foreground">Saldo Livre Real:</span>
            </div>
            <MoneyText
              cents={safeToSpend.safeToSpendCents}
              tone={safeToSpend.safeToSpendCents >= 0 ? "positive" : "negative"}
              animated
              className="font-semibold text-xs sm:text-sm shrink-0"
            />
          </div>
        </div>
      </div>

      <CashCheckpointDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentBalanceCents={cashBalance.currentBalanceCents}
      />
    </>
  );
}
