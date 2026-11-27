import { Coins, Compass, Plus } from "lucide-react";
import { HighlightRow } from "@/components/modules";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { startDemo } from "@/state/demo-mode";
import type { Debt, Loan } from "@/types";
import { LoanCard } from "./loan-card";

export interface LoansTabContentProps {
  loans: Loan[];
  debts: Debt[];
  isLoading: boolean;
  highlightId?: string | null;
  onOpenNewLoan: () => void;
}

/** Conteúdo da aba de Contratos de Empréstimo e Financiamento. */
export function LoansTabContent({
  loans,
  debts,
  isLoading,
  highlightId = null,
  onOpenNewLoan,
}: LoansTabContentProps) {
  return (
    <div data-tour="debts-loans-section" className="flex flex-col gap-4">
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3.5 p-4 sm:p-5 rounded-xl border border-border/80 bg-surface shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-lg shrink-0" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/80">
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : loans.length === 0 ? (
        <EmptyState
          icon={<Coins className="size-6" aria-hidden="true" />}
          title="Nenhum contrato cadastrado"
          description="Cadastre seus contratos de crédito (Price ou SAC) para simular amortizações e acompanhar o saldo devedor."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" onClick={onOpenNewLoan} className="gap-1.5">
                <Plus aria-hidden="true" className="size-4" />
                Cadastrar contrato
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startDemo("finances_debts")}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Compass className="size-4" aria-hidden="true" />
                <span>Ver exemplo na Simulação</span>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {loans.map((loan) => (
            <HighlightRow key={loan.id} highlightId={highlightId} id={loan.id}>
              <LoanCard loan={loan} debts={debts} />
            </HighlightRow>
          ))}
        </div>
      )}
    </div>
  );
}
