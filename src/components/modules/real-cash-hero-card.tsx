import { useState } from "react";
import { Scale, ShieldCheck, ArrowDownRight } from "lucide-react";
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
          "flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border",
          className,
        )}
      >
        {/* Topo do Card: Título + Badge + Ação de Calibrar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
                  Saldo Disponível em Conta
                </h2>
                {hasCheckpoint ? (
                  <Badge variant="muted" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground border-border">
                    Aferido em {formatDateBR(latestCheckpoint.date)}
                  </Badge>
                ) : (
                  <Badge variant="muted" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground border-border">
                    Acumulado do Fluxo
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground truncate">
                Soma real das contas correntes e dinheiro líquido hoje
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 text-xs h-8 shrink-0 w-full sm:w-auto justify-center font-medium border-border/80 hover:bg-surface-hover"
          >
            <Scale className="size-3.5 text-primary" aria-hidden="true" />
            Calibrar com o banco
          </Button>
        </div>

        {/* Valor Principal em Destaque */}
        <div className="flex items-baseline gap-2 pt-0.5">
          <MoneyText
            cents={cashBalance.currentBalanceCents}
            tone={cashBalance.currentBalanceCents >= 0 ? "default" : "negative"}
            className="text-2xl sm:text-3xl font-bold tracking-tight"
          />
        </div>

        {/* Linha de Projeção Safe-to-Spend */}
        <div className="flex flex-col gap-2 rounded-xl bg-surface-hover/50 border border-border/60 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
            <ArrowDownRight className="size-3.5 shrink-0 text-negative" aria-hidden="true" />
            <span className="truncate">Faturas e contas a pagar do ciclo:</span>
            <MoneyText
              cents={safeToSpend.committedObligationsCents}
              tone="negative"
              className="font-medium shrink-0"
            />
          </div>

          <div className="flex items-center gap-1.5 pt-1 sm:pt-0 border-t border-border/40 sm:border-t-0 shrink-0">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
            <span className="text-muted-foreground">Saldo Livre Real:</span>
            <MoneyText
              cents={safeToSpend.safeToSpendCents}
              tone={safeToSpend.safeToSpendCents >= 0 ? "positive" : "negative"}
              className="font-semibold text-xs sm:text-sm"
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
