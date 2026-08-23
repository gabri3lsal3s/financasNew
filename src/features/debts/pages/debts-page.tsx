import { useState } from "react";
import { useSearchParams } from "react-router";
import { Calendar, Check, ChevronDown, ChevronUp, Coins, HandCoins, Plus } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, Skeleton, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { DebtStatusBadge, HighlightRow } from "@/components/modules";
import { debtStatus, todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import { currentMonth, formatDateBR, monthLabel } from "@/lib/date";
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
 * Linha de dívida refinada — layout em 2 níveis claro e adaptado para mobile e desktop.
 */
function DebtRow({ debt, onSettle, onUnsettle, onEdit }: DebtRowProps) {
  const status = debtStatus(debt.due_date, debt.paid_at);
  const isPaid = status === "paid";

  return (
    <div className="group flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-surface/90 p-3.5 sm:p-4 shadow-xs transition-all hover:border-border hover:bg-surface">
      {/* Linha superior: Nome + Badge à esquerda, Valor à direita */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <button
          type="button"
          aria-label={`Editar ${debt.name}`}
          onClick={() => {
            triggerHaptic("light");
            onEdit(debt);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md cursor-pointer active:scale-[0.99]"
        >
          <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {debt.name}
          </span>
          {!isPaid ? <DebtStatusBadge status={status} /> : null}
        </button>

        <div className="shrink-0 text-right">
          <MoneyText
            cents={numberToCents(debt.amount)}
            variant="value"
            tone={debt.type === "receivable" ? "positive" : "negative"}
            className="text-sm sm:text-base font-bold"
          />
        </div>
      </div>

      {/* Linha inferior: Data de vencimento/quitação à esquerda, Ação à direita */}
      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs">
          <Calendar className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span>
            {isPaid
              ? `Quitada em ${formatDateBR(debt.paid_at ?? debt.due_date)}`
              : `Vencimento: ${formatDateBR(debt.due_date)}`}
          </span>
          {debt.expense_id ? (
            <span className="hidden sm:inline text-muted-foreground/60">· vinculada a despesa</span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center">
          {isPaid ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onUnsettle(debt);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-positive/30 bg-positive/10 px-2.5 text-[11px] font-medium text-positive-strong hover:bg-positive/20 active:scale-95 transition-all cursor-pointer"
              aria-label={`Quitada (${debt.name}) — clique para desmarcar`}
              title={`Quitada (${debt.name}) — clique para desmarcar`}
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>Quitada</span>
            </button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              aria-label={`Quitar ${debt.name}`}
              onClick={() => {
                triggerHaptic("light");
                onSettle(debt);
              }}
              className="h-7 px-2.5 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
            >
              <Check className="size-3.5 mr-1" aria-hidden="true" />
              {debt.type === "receivable" ? "Receber" : "Quitar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Dívidas / contas a pagar e receber (§3.4) — agrupamento inteligente por urgência + financiamentos. */
export function DebtsPage() {
  const debtsQuery = useDebts();
  const loansQuery = useLoans();
  const deleteDebt = useDeleteDebt();
  const updateDebt = useUpdateDebt();
  const [searchParams, setSearchParams] = useSearchParams();
  const { highlightId } = useHighlightTarget("q");

  // Estado de visualização do histórico de quitadas
  const [showPaid, setShowPaid] = useState(false);

  // Aba derivada: deep-link ?type= (busca §3.9) prevalece; sem param, usa a
  // escolha manual (tabs). O pick manual limpa o param.
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

  const payablePendingCents = debts
    .filter((d) => d.type === "payable" && !d.paid_at)
    .reduce((sum, d) => sum + numberToCents(d.amount), 0);
  const receivablePendingCents = debts
    .filter((d) => d.type === "receivable" && !d.paid_at)
    .reduce((sum, d) => sum + numberToCents(d.amount), 0);
  const netPendingCents = receivablePendingCents - payablePendingCents;

  const error = debtsQuery.error || loansQuery.error;

  // Agrupamento temporal inteligente para evitar sobrecarga visual
  const today = todayISO();
  const thisMonth = currentMonth();

  const overdueOrToday: Debt[] = [];
  const thisMonthList: Debt[] = [];
  const futureList: Debt[] = [];
  const paidList: Debt[] = [];

  for (const debt of filtered) {
    const status = debtStatus(debt.due_date, debt.paid_at, today);
    if (status === "paid") {
      paidList.push(debt);
    } else if (status === "overdue" || status === "due_today") {
      overdueOrToday.push(debt);
    } else if (debt.due_date.slice(0, 7) === thisMonth) {
      thisMonthList.push(debt);
    } else {
      futureList.push(debt);
    }
  }

  // Ordenação prioritária
  overdueOrToday.sort((a, b) => a.due_date.localeCompare(b.due_date));
  thisMonthList.sort((a, b) => a.due_date.localeCompare(b.due_date));
  futureList.sort((a, b) => a.due_date.localeCompare(b.due_date));
  paidList.sort((a, b) => (b.paid_at ?? b.due_date).localeCompare(a.paid_at ?? a.due_date));

  // Quitadas ficam visíveis automaticamente se não houver nenhuma pendente
  const hasPending = overdueOrToday.length > 0 || thisMonthList.length > 0 || futureList.length > 0;
  const isPaidVisible = showPaid || !hasPending;

  return (
    <div className="flex flex-col gap-6">
      {/* Header com ações acessíveis tanto no mobile quanto no desktop */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Dívidas
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Gestão de contas a pagar, a receber e financiamentos
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
          variant="pills"
          swipeable
          items={[
            {
              value: "payable",
              label: `A pagar (${payableDebts.length})`,
              shortLabel: `A Pagar (${payableDebts.length})`,
              content: null,
            },
            {
              value: "receivable",
              label: `A receber (${receivableDebts.length})`,
              shortLabel: `A Receber (${receivableDebts.length})`,
              content: null,
            },
            {
              value: "loans",
              label: `Financiamentos (${loans.length})`,
              shortLabel: `Financ. (${loans.length})`,
              content: null,
            },
          ]}
        />
      )}

      {/* Resumo financeiro consolidado: 3 cards proporcionais no mobile e desktop */}
      {tab !== "loans" && !error && !debtsQuery.isLoading && debts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex flex-col gap-0.5 sm:gap-1 rounded-2xl border border-border/80 bg-surface/90 p-3 sm:p-4 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              A pagar
            </span>
            <MoneyText cents={payablePendingCents} tone="negative" className="text-sm sm:text-lg font-bold" />
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-1 rounded-2xl border border-border/80 bg-surface/90 p-3 sm:p-4 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              A receber
            </span>
            <MoneyText cents={receivablePendingCents} tone="positive" className="text-sm sm:text-lg font-bold" />
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-1 rounded-2xl border border-border/80 bg-surface/90 p-3 sm:p-4 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Saldo pendente
            </span>
            <MoneyText
              cents={netPendingCents}
              tone={netPendingCents >= 0 ? "positive" : "negative"}
              sign="auto"
              className="text-sm sm:text-lg font-bold"
            />
          </div>
        </div>
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

      {/* Conteúdo de Dívidas (A pagar / A receber) com Agrupamento Inteligente */}
      {tab !== "loans" && (
        <>
          {debtsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
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
            <div className="flex flex-col gap-6">
              {/* Grupo 1: Atrasadas e Vencendo Hoje */}
              {overdueOrToday.length > 0 && (
                <section aria-label="Contas atrasadas e vencendo hoje" className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-2 rounded-full bg-critical-strong animate-pulse" />
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-critical-strong">
                        Atrasadas & Vencendo Hoje
                      </h2>
                    </div>
                    <Badge variant="critical" className="text-[11px] font-semibold">
                      {overdueOrToday.length}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {overdueOrToday.map((debt) => (
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
                </section>
              )}

              {/* Grupo 2: Vencimento no Mês Corrente */}
              {thisMonthList.length > 0 && (
                <section aria-label="Contas do mês atual" className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vencimento em {monthLabel(thisMonth)}
                    </h2>
                    <span className="text-xs text-muted-foreground font-mono font-medium">
                      {thisMonthList.length} {thisMonthList.length === 1 ? "conta" : "contas"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {thisMonthList.map((debt) => (
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
                </section>
              )}

              {/* Grupo 3: Próximos Vencimentos (Futuros) */}
              {futureList.length > 0 && (
                <section aria-label="Próximos vencimentos" className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Próximos Vencimentos
                    </h2>
                    <span className="text-xs text-muted-foreground font-mono font-medium">
                      {futureList.length} {futureList.length === 1 ? "conta" : "contas"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {futureList.map((debt) => (
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
                </section>
              )}

              {/* Grupo 4: Quitadas / Histórico (Colapsável) */}
              {paidList.length > 0 && (
                <section aria-label="Histórico de quitadas" className="flex flex-col gap-2.5 pt-1">
                  {hasPending ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPaid((prev) => !prev)}
                      className="flex items-center justify-between py-3 px-3.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/80 rounded-xl bg-surface/50 transition-all cursor-pointer"
                      aria-expanded={isPaidVisible}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                        Quitadas ({paidList.length})
                      </span>
                      {isPaidVisible ? (
                        <ChevronUp className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Quitadas ({paidList.length})
                      </h2>
                    </div>
                  )}

                  {isPaidVisible && (
                    <div className="flex flex-col gap-2.5">
                      {paidList.map((debt) => (
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
                </section>
              )}
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

