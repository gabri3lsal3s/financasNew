import { useState } from "react";
import { useSearchParams } from "react-router";
import { Check, Coins, HandCoins, Plus } from "lucide-react";
import { Button, EmptyState, ErrorState, Skeleton, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { DebtStatusBadge, HighlightRow } from "@/components/modules";
import { debtStatus } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { triggerHaptic } from "@/services/haptics";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useDebts, useDeleteDebt, useLoans, useUpdateDebt } from "@/state";
import { DebtFormDialog } from "@/features/debts/components/debt-form-dialog";
import { SettleDialog } from "@/features/debts/components/settle-dialog";
import { LoanCard } from "@/features/debts/components/loan-card";
import { LoanFormDialog } from "@/features/debts/components/loan-form-dialog";
import type { Debt } from "@/types";

interface DebtRowProps {
  debt: Debt;
  onSettle: (debt: Debt) => void;
  onUnsettle: (debt: Debt) => void;
  onEdit: (debt: Debt) => void;
}

/**
 * Linha de dívida — nível de módulo (nunca aninhada em `DebtsPage`): evita que
 * o React remonte todas as linhas a cada render da página (tipo de componente
 * novo por render → perda de foco/jank com listas grandes). Callbacks via props.
 */
function DebtRow({ debt, onSettle, onUnsettle, onEdit }: DebtRowProps) {
  const status = debtStatus(debt.due_date, debt.paid_at);
  const isPaid = status === "paid";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover/60">
      <button
        type="button"
        aria-label={`Editar ${debt.name}`}
        onClick={() => {
          triggerHaptic("light");
          onEdit(debt);
        }}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg cursor-pointer py-0.5 active:scale-[0.99]"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{debt.name}</p>
            {!isPaid ? <DebtStatusBadge status={status} /> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Vence em {debt.due_date}
            {debt.paid_at ? ` · quitada em ${debt.paid_at.slice(0, 10)}` : ""}
            {debt.expense_id ? " · vinculada a despesa" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right pr-1">
          <MoneyText
            cents={Math.round(debt.amount * 100)}
            variant="value"
            tone={debt.type === "receivable" ? "positive" : "negative"}
          />
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {isPaid ? (
          <div
            className="inline-flex items-center rounded-lg border border-positive/40 bg-positive/10 p-0.5 shadow-sm transition-all duration-200"
            role="group"
            aria-label={`Ações para ${debt.name}`}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onUnsettle(debt);
              }}
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-positive-strong transition-all duration-200 hover:bg-positive/20 active:scale-95 sm:h-8"
              aria-label={`Quitada (${debt.name}) — clique para desmarcar`}
              title={`Quitada (${debt.name}) — clique para desmarcar`}
            >
              <Check className="size-3.5 animate-spring-pop sm:size-4" aria-hidden="true" />
              <span>Quitada</span>
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            aria-label={`Quitar ${debt.name}`}
            onClick={() => {
              triggerHaptic("light");
              onSettle(debt);
            }}
          >
            Quitar
          </Button>
        )}
      </div>
    </div>
  );
}

/** Dívidas / contas a pagar e receber (§3.4) — status derivado + quitação integrada + financiamentos. */
export function DebtsPage() {
  const debtsQuery = useDebts();
  const loansQuery = useLoans();
  const deleteDebt = useDeleteDebt();
  const updateDebt = useUpdateDebt();
  const [searchParams, setSearchParams] = useSearchParams();
  const { highlightId } = useHighlightTarget("q");

  // Aba derivada: deep-link ?type= (busca §3.9) prevalece; sem param, usa a
  // escolha manual (tabs). O pick manual limpa o param (sem setState em effect).
  const paramType = searchParams.get("type");
  const [pickedTab, setPickedTab] = useState<"payable" | "receivable" | "loans">("payable");
  const tab: "payable" | "receivable" | "loans" =
    paramType === "receivable"
      ? "receivable"
      : paramType === "payable"
        ? "payable"
        : paramType === "loans"
          ? "loans"
          : pickedTab;

  const handleTabChange = (next: "payable" | "receivable" | "loans") => {
    setPickedTab(next);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("type");
        return updated;
      },
      { replace: true },
    );
  };

  const handleUnsettle = async (debt: Debt) => {
    try {
      await updateDebt.mutateAsync({
        id: debt.id,
        input: { paid_at: null },
      });
    } catch {
      // Erro tratado pela infraestrutura de mutação
    }
  };

  // FAB contextual (F12): ?novo=divida abre o formulário de criação.
  const { open: formOpen, setOpen: setFormOpen } = useCreateDeepLink("divida");
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [settling, setSettling] = useState<Debt | null>(null);
  const [loanFormOpen, setLoanFormOpen] = useState(false);

  const debts = debtsQuery.data ?? [];
  const loans = loansQuery.data ?? [];
  const payableDebts = debts.filter((d) => d.type === "payable");
  const receivableDebts = debts.filter((d) => d.type === "receivable");
  const filtered = tab === "payable" ? payableDebts : tab === "receivable" ? receivableDebts : [];

  const error = debtsQuery.error || loansQuery.error;

  return (
    <div className="flex flex-col gap-6">
      {/* Header com ações acessíveis tanto no mobile quanto no desktop */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Dívidas & Financiamentos
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Gestão de contas a pagar, a receber e contratos de amortização.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Financiamento"
            className="flex-1 sm:flex-initial"
            onClick={() => setLoanFormOpen(true)}
          >
            <Coins aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Financiamento</span>
            <span className="sm:hidden">Contrato</span>
          </Button>
          <Button
            size="sm"
            aria-label="Nova dívida"
            className="flex-1 sm:flex-initial"
            onClick={() => {
              setEditingDebt(null);
              setFormOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Nova dívida
          </Button>
        </div>
      </header>

      {error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => handleTabChange(value as "payable" | "receivable" | "loans")}
          swipeable
          items={[
            {
              value: "payable",
              label: `A pagar (${payableDebts.length})`,
              content: null,
            },
            {
              value: "receivable",
              label: `A receber (${receivableDebts.length})`,
              content: null,
            },
            {
              value: "loans",
              label: `Financiamentos (${loans.length})`,
              content: null,
            },
          ]}
        />
      )}

      {/* Conteúdo de Financiamentos */}
      {tab === "loans" && (
        <div className="flex flex-col gap-4">
          {loansQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : loans.length === 0 ? (
            <EmptyState
              icon={<Coins className="size-6" aria-hidden="true" />}
              title="Nenhum financiamento ou empréstimo"
              description="Cadastre seus contratos de crédito (Price ou SAC) para simular amortizações e acompanhar o saldo devedor."
              action={
                <Button size="sm" onClick={() => setLoanFormOpen(true)}>
                  <Plus aria-hidden="true" className="size-4" />
                  Cadastrar contrato
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {loans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} debts={debts} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo de Dívidas (A pagar / A receber) */}
      {tab !== "loans" && (
        <>
          {debtsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<HandCoins className="size-6" aria-hidden="true" />}
              title={tab === "payable" ? "Nenhuma conta a pagar" : "Nenhuma conta a receber"}
              description={
                tab === "payable"
                  ? "Cadastre contas a pagar para acompanhar vencimentos e quitações."
                  : "Cadastre contas a receber para acompanhar valores a receber."
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((debt) => (
                <HighlightRow key={debt.id} highlightId={highlightId} id={debt.id}>
                  <DebtRow
                    debt={debt}
                    onSettle={setSettling}
                    onUnsettle={handleUnsettle}
                    onEdit={(d) => {
                      setEditingDebt(d);
                      setFormOpen(true);
                    }}
                  />
                </HighlightRow>
              ))}
            </div>
          )}
        </>
      )}

      <DebtFormDialog
        debt={editingDebt}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditingDebt(null);
        }}
        // Exclusão com feedback: o hook exibe toast em falha e o formulário
        // permanece aberto com o erro (o diálogo rejeita a promise).
        onDelete={async (debt) => {
          await deleteDebt.mutateAsync(debt.id);
        }}
      />

      <LoanFormDialog
        open={loanFormOpen}
        onOpenChange={setLoanFormOpen}
      />

      {settling ? <SettleDialog debt={settling} open={settling !== null} onOpenChange={(next) => !next && setSettling(null)} /> : null}
    </div>
  );
}

