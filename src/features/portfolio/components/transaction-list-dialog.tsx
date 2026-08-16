import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, Modal, SkeletonTable } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { useAssetPosition, useDeletePortfolioTransaction } from "@/state";
import { PORTFOLIO_TX_LABELS } from "@/lib/labels";
import { numberToCents } from "@/domain/money";
import { formatDateBR } from "@/lib/date";
import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { playSound } from "@/services/audio-fx";
import { triggerHaptic } from "@/services/haptics";
import { TransactionFormDialog } from "./transaction-form-dialog";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

export interface TransactionListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PortfolioAsset | null;
}

const formatQty = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

/**
 * Lançamentos de um ativo (§3.11.2) — extrato da operação com controle total:
 * lista cronológica, edição e exclusão de cada lançamento, e acesso ao
 * cadastro de nova transação. O ledger é derivado e sempre recalculado.
 */
export function TransactionListDialog({ open, onOpenChange, asset }: TransactionListDialogProps) {
  const transactionsQuery = useAssetPosition(asset?.id ?? null);
  const deleteTx = useDeletePortfolioTransaction();
  const [editing, setEditing] = useState<PortfolioTransaction | null>(null);
  const [deleting, setDeleting] = useState<PortfolioTransaction | null>(null);

  const transactions = [...(transactionsQuery.data ?? [])].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTx.mutateAsync(deleting.id);
      triggerHaptic("warning");
      playSound("delete", getVisualCustomization().soundEnabled);
    } catch {
      // Falha: o toast do hook (useDeletePortfolioTransaction) já exibiu o erro.
    } finally {
      // Fecha a confirmação em sucesso E em falha — antes, falha deixava o
      // diálogo preso com a exclusão "engolida" (sem nenhum feedback).
      setDeleting(null);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={`Lançamentos · ${asset?.ticker ?? ""}`}
        description="Extrato cronológico das operações do ativo. Edite ou exclua qualquer lançamento — o ledger é recalculado automaticamente."
      >
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="muted" className="text-[11px]">
              {transactions.length} {transactions.length === 1 ? "lançamento" : "lançamentos"}
            </Badge>
            {asset ? (
              <Button type="button" size="sm" onClick={() => setEditing(null)} disabled={editing !== null}>
                <Plus aria-hidden="true" />
                Novo lançamento
              </Button>
            ) : null}
          </div>

          {transactionsQuery.isLoading ? (
            <SkeletonTable rows={4} />
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<Plus className="size-6" aria-hidden="true" />}
              title="Sem lançamentos"
              description={`Registre a primeira transação de ${asset?.ticker ?? "este ativo"} para montar a posição.`}
              tone="portfolio"
              headingLevel="h2"
              action={
                asset ? (
                  <Button type="button" size="sm" onClick={() => setEditing(null)}>
                    <Plus aria-hidden="true" />
                    Registrar transação
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border/70 rounded-xl border border-border/80">
              {transactions.map((tx) => {
                const isDividend = tx.type === "dividend" || tx.type === "jcp" || tx.type === "fii_yield";
                const isSplit = tx.type === "split" || tx.type === "reverse_split";
                return (
                  <li key={tx.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-foreground">{PORTFOLIO_TX_LABELS[tx.type]}</span>
                      <span className="num text-[11px] text-muted-foreground">
                        {formatDateBR(tx.date)}
                        {isSplit ? ` · fator ${formatQty(tx.quantity)}` : !isDividend && tx.quantity > 0 ? ` · ${formatQty(tx.quantity)} qtd` : ""}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="num text-sm font-semibold text-foreground">
                        {isDividend ? <MoneyText cents={numberToCents(tx.total)} tone="positive" /> : isSplit ? "—" : <MoneyText cents={numberToCents(tx.total)} tone="default" />}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-9 px-2"
                        aria-label={`Editar ${PORTFOLIO_TX_LABELS[tx.type]}`}
                        onClick={() => setEditing(tx)}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-9 px-2 text-negative-strong hover:text-negative-strong"
                        aria-label={`Excluir ${PORTFOLIO_TX_LABELS[tx.type]}`}
                        onClick={() => setDeleting(tx)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {asset ? (
        <TransactionFormDialog
          key={editing?.id ?? "new"}
          open={editing !== null}
          onOpenChange={(next) => !next && setEditing(null)}
          asset={asset}
          transaction={editing}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Excluir lançamento?"
        description={
          deleting
            ? `${PORTFOLIO_TX_LABELS[deleting.type]} de ${formatDateBR(deleting.date)} será removida. O ledger da posição é recalculado automaticamente.`
            : undefined
        }
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteTx.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
