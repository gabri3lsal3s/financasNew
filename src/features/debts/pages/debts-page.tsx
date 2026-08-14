import { useState } from "react";
import { useSearchParams } from "react-router";
import { CheckCircle2, HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, Skeleton, Tabs } from "@/components/ui";
import { DebtStatusBadge, HighlightRow } from "@/components/modules";
import { debtStatus } from "@/domain/debts";
import { formatCentsAsBRL } from "@/services/masks/money";
import { getErrorMessage } from "@/services/errors";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useDebts, useDeleteDebt } from "@/state";
import { DebtFormDialog } from "@/features/debts/components/debt-form-dialog";
import { SettleDialog } from "@/features/debts/components/settle-dialog";
import type { Debt } from "@/types";

/** Dívidas / contas a pagar e receber (§3.4) — status derivado + quitação integrada. */
export function DebtsPage() {
  const debtsQuery = useDebts();
  const deleteDebt = useDeleteDebt();
  const [searchParams, setSearchParams] = useSearchParams();
  const { highlightId } = useHighlightTarget("q");

  // Aba derivada: deep-link ?type= (busca §3.9) prevalece; sem param, usa a
  // escolha manual (tabs). O pick manual limpa o param (sem setState em effect).
  const paramType = searchParams.get("type");
  const [pickedTab, setPickedTab] = useState<"payable" | "receivable">("payable");
  const tab: "payable" | "receivable" =
    paramType === "receivable" ? "receivable" : paramType === "payable" ? "payable" : pickedTab;

  const handleTabChange = (next: "payable" | "receivable") => {
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [settling, setSettling] = useState<Debt | null>(null);
  const [deleting, setDeleting] = useState<Debt | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debts = debtsQuery.data ?? [];
  const filtered = debts.filter((debt) => debt.type === tab);

  const error = debtsQuery.error;

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await deleteDebt.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  };

  const DebtRow = ({ debt }: { debt: Debt }) => {
    const status = debtStatus(debt.due_date, debt.paid_at);
    const isPaid = status === "paid";
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{debt.name}</p>
            <DebtStatusBadge status={status} />
          </div>
          <p className="text-xs text-muted-foreground">
            Vence em {debt.due_date}
            {debt.paid_at ? ` · quitada em ${debt.paid_at.slice(0, 10)}` : ""}
            {debt.expense_id ? " · vinculada a despesa" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`num text-sm font-semibold ${debt.type === "receivable" ? "text-positive-strong" : "text-negative-strong"}`}>
            {formatCentsAsBRL(Math.round(debt.amount * 100))}
          </span>
          {isPaid ? (
            <CheckCircle2 className="size-5 text-positive-strong" aria-label="Quitada" />
          ) : (
            <Button size="sm" variant="outline" aria-label={`Quitar ${debt.name}`} onClick={() => setSettling(debt)}>
              Quitar
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Editar ${debt.name}`}
            onClick={() => {
              setEditingDebt(debt);
              setFormOpen(true);
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={`Excluir ${debt.name}`} onClick={() => setDeleting(debt)}>
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Dívidas</h1>
        <Button
          onClick={() => {
            setEditingDebt(null);
            setFormOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          Nova dívida
        </Button>
      </header>

      {error ? (
        <Alert variant="error">{getErrorMessage(error)}</Alert>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => handleTabChange(value as "payable" | "receivable")}
          items={[
            {
              value: "payable",
              label: `A pagar (${debts.filter((d) => d.type === "payable").length})`,
              content: null,
            },
            {
              value: "receivable",
              label: `A receber (${debts.filter((d) => d.type === "receivable").length})`,
              content: null,
            },
          ]}
        />
      )}

      {debtsQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
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
              <DebtRow debt={debt} />
            </HighlightRow>
          ))}
        </div>
      )}

      <DebtFormDialog
        debt={editingDebt}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditingDebt(null);
        }}
      />

      {settling ? <SettleDialog debt={settling} open={settling !== null} onOpenChange={(next) => !next && setSettling(null)} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        title="Excluir dívida?"
        description="Esta ação não pode ser desfeita. Dívidas quitadas permanecem no histórico."
        confirmLabel={deleteDebt.isPending ? "Excluindo…" : "Excluir"}
        variant="destructive"
        confirmPending={deleteDebt.isPending}
        onConfirm={() => void handleConfirmDelete()}
      >
        {deleteError ? (
          <div className="mt-4">
            <Alert variant="error">{deleteError}</Alert>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
