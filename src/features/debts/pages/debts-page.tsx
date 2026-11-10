import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, ChevronUp, Coins, Download, HandCoins, Landmark, Plus } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, Skeleton, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { HighlightRow, KpiCard, KpiGrid, ReadOnlyBanner, UpgradeDialog } from "@/components/modules";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import { calculateDebtsSummary, debtStatus, todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";

import { serializeDebtsCsv, type ExportDebtRow } from "@/domain/export";
import { currentMonth, monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { downloadCsv } from "@/services/export-actions";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useDebts, useDeleteDebt, useLoans, usePermission, useUpdateDebt } from "@/state";
import {
  DebtFormDialog,
  DebtRow,
  LoanCard,
  LoanFormDialog,
  SettleDialog,
} from "@/features/debts/components";
import type { Debt } from "@/types";

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
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Desmarcar Quitação de Conta");
      setUpgradeOpen(true);
      return;
    }
    try {
      await updateDebt.mutateAsync({
        id: debt.id,
        input: { paid_at: null },
      });
    } catch {
      // Erro tratado pela infraestrutura de mutação
    }
  };

  const permission = usePermission("debts");
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<string | undefined>();

  // FAB contextual (F12): ?novo=divida abre o formulário de criação.
  const { open: formOpen, setOpen: setFormOpen } = useCreateDeepLink("divida");
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [settling, setSettling] = useState<Debt | null>(null);
  const [loanFormOpen, setLoanFormOpen] = useState(false);

  const handleOpenDebtForm = (debt: Debt | null) => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext(debt ? "Editar Dívida / Conta" : "Cadastrar Nova Dívida");
      setUpgradeOpen(true);
      return;
    }
    setEditingDebt(debt);
    setFormOpen(true);
  };

  const handleOpenLoanForm = () => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Cadastrar Contrato de Crédito");
      setUpgradeOpen(true);
      return;
    }
    setLoanFormOpen(true);
  };

  const handleSettle = (debt: Debt) => {
    if (permission.isReadOnlyMode) {
      setUpgradeContext("Quitar Dívida / Baixar Conta");
      setUpgradeOpen(true);
      return;
    }
    setSettling(debt);
  };

  const debts = useMemo(() => debtsQuery.data ?? [], [debtsQuery.data]);
  const loans = useMemo(() => loansQuery.data ?? [], [loansQuery.data]);
  const payableDebts = useMemo(() => debts.filter((d) => d.type === "payable"), [debts]);
  const receivableDebts = useMemo(() => debts.filter((d) => d.type === "receivable"), [debts]);

  const debtsSummary = useMemo(() => calculateDebtsSummary(debts), [debts]);
  const { payablePendingCents, receivablePendingCents, netPendingCents } = debtsSummary;


  const error = debtsQuery.error || loansQuery.error;
  const today = todayISO();
  const thisMonth = currentMonth();

  const handleExportDebtsCsv = () => {
    if (tab === "loans") {
      if (loans.length === 0) return;
      const rows: ExportDebtRow[] = loans.map((loan) => ({
        name: loan.name,
        type: "payable",
        status: "Ativo",
        amountCents: numberToCents(loan.principal_amount),
        dueDate: loan.start_date,
        paidAt: null,
        notes: `Taxa: ${loan.interest_rate_monthly}% a.m. | Parcelas: ${loan.total_installments}x (${loan.amortization_system})`,
      }));
      downloadCsv(`financiamentos_${today}.csv`, serializeDebtsCsv(rows));
      return;
    }

    const currentList = tab === "payable" ? payableDebts : receivableDebts;
    const filteredList = showPaid ? currentList : currentList.filter((d) => !d.paid_at);
    if (filteredList.length === 0) return;

    const rows: ExportDebtRow[] = filteredList.map((d) => {
      const status = debtStatus(d.due_date, d.paid_at, today);
      let statusLabel = "Pendente";
      if (status === "paid") statusLabel = "Quitada";
      else if (status === "overdue") statusLabel = "Atrasada";
      else if (status === "due_today") statusLabel = "Vence Hoje";

      return {
        name: d.name,
        type: d.type,
        status: statusLabel,
        amountCents: numberToCents(d.amount),
        dueDate: d.due_date,
        paidAt: d.paid_at ?? null,
        notes: null,
      };
    });

    const filePrefix = tab === "payable" ? "contas_a_pagar" : "contas_a_receber";
    const statusSlug = showPaid ? "todas" : "pendentes";
    downloadCsv(`${filePrefix}_${statusSlug}_${today}.csv`, serializeDebtsCsv(rows));
  };

  const renderDebtsContent = (type: "payable" | "receivable") => {
    const list = type === "payable" ? payableDebts : receivableDebts;
    const overdueOrToday: Debt[] = [];
    const thisMonthList: Debt[] = [];
    const futureList: Debt[] = [];
    const paidList: Debt[] = [];

    for (const debt of list) {
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

    overdueOrToday.sort((a, b) => a.due_date.localeCompare(b.due_date));
    thisMonthList.sort((a, b) => a.due_date.localeCompare(b.due_date));
    futureList.sort((a, b) => a.due_date.localeCompare(b.due_date));
    paidList.sort((a, b) => (b.paid_at ?? b.due_date).localeCompare(a.paid_at ?? a.due_date));

    const hasPending = overdueOrToday.length > 0 || thisMonthList.length > 0 || futureList.length > 0;
    const isPaidVisible =
      showPaid || !hasPending || Boolean(highlightId && paidList.some((d) => d.id === highlightId));

    return (
      <div
        data-tour={type === "payable" ? "debts-payable-section" : "debts-receivable-section"}
        className="flex flex-col gap-6"
      >
        {/* Resumo financeiro consolidado */}
        {!debtsQuery.isLoading && debts.length > 0 && (
          <KpiGrid columns={3}>
            <KpiCard label="A pagar" cents={payablePendingCents} tone="negative" />
            <KpiCard label="A receber" cents={receivablePendingCents} tone="positive" />
            <KpiCard
              label="Saldo pendente"
              cents={netPendingCents}
              tone={netPendingCents >= 0 ? "positive" : "negative"}
            />
          </KpiGrid>
        )}

        {debtsQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<HandCoins className="size-6" aria-hidden="true" />}
            title={type === "payable" ? "Nenhuma conta a pagar" : "Nenhuma conta a receber"}
            description={
              type === "payable"
                ? "Cadastre contas a pagar para acompanhar vencimentos e quitações."
                : "Cadastre contas a receber para acompanhar valores a receber."
            }
            action={
              <Button
                size="sm"
                onClick={() => handleOpenDebtForm(null)}
                className="gap-1.5 cursor-pointer"
              >
                <Plus className="size-4" aria-hidden="true" />
                {type === "payable" ? "Nova conta a pagar" : "Nova conta a receber"}
              </Button>
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
                  <Badge variant="critical" size="xs">
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
                          onSettle={handleSettle}
                          onUnsettle={handleUnsettle}
                          onEdit={handleOpenDebtForm}
                        />
                      </HighlightRow>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLoansContent = () => (
    <div data-tour="debts-loans-section" className="flex flex-col gap-4">
      {loansQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : loans.length === 0 ? (
        <EmptyState
          icon={<Coins className="size-6" aria-hidden="true" />}
          title="Nenhum contrato cadastrado"
          description="Cadastre seus contratos de crédito (Price ou SAC) para simular amortizações e acompanhar o saldo devedor."
          action={
            <Button size="sm" onClick={handleOpenLoanForm}>
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
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header canônico com ações responsivas */}
      <PageHeader
        title="Contas & Dívidas"
        description="Gestão de contas a pagar, a receber e contratos"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportDebtsCsv}
              disabled={tab === "loans" ? loans.length === 0 : (tab === "payable" ? payableDebts : receivableDebts).length === 0}
              className="flex-1 sm:flex-initial gap-1.5"
              aria-label="Exportar CSV"
              title="Exportar contas em CSV"
            >
              <Download className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Exportar </span>CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Novo contrato"
              className="flex-1 sm:flex-initial"
              onClick={handleOpenLoanForm}
            >
              <Coins aria-hidden="true" className="size-4" />
              Contrato
            </Button>
            <Button
              size="sm"
              aria-label="Nova dívida"
              className="flex-1 sm:flex-initial"
              onClick={() => handleOpenDebtForm(null)}
            >
              <Plus aria-hidden="true" className="size-4" />
              Nova dívida
            </Button>
          </>
        }
      />

      {permission.isReadOnlyMode && (
        <ReadOnlyBanner
          onActivatePro={() => {
            setUpgradeContext(undefined);
            setUpgradeOpen(true);
          }}
        />
      )}

      {error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => handleTabChange(value as "payable" | "receivable" | "loans")}
          variant="underline"
          swipeable
          items={[
            {
              value: "payable",
              label: "Pagar",
              icon: <ArrowUpRight className="size-4" aria-hidden="true" />,
              content: renderDebtsContent("payable"),
            },
            {
              value: "receivable",
              label: "Receber",
              icon: <ArrowDownLeft className="size-4" aria-hidden="true" />,
              content: renderDebtsContent("receivable"),
            },
            {
              value: "loans",
              label: "Contratos",
              icon: <Landmark className="size-4" aria-hidden="true" />,
              content: renderLoansContent(),
            },
          ]}
        />
      )}

      <DebtFormDialog
        debt={editingDebt}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditingDebt(null);
        }}
        onDelete={async (debt, mode) => {
          await deleteDebt.mutateAsync({ id: debt.id, mode });
        }}
      />

      <LoanFormDialog
        open={loanFormOpen}
        onOpenChange={setLoanFormOpen}
      />

      {settling ? <SettleDialog debt={settling} open={settling !== null} onOpenChange={(next) => !next && setSettling(null)} /> : null}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        context={upgradeContext}
        onProceedToCheckout={(p) => {
          setUpgradeOpen(false);
          navigate(buildCheckoutUrl({ plan: p }));
        }}
      />
    </div>
  );
}

