import type { ReactNode } from "react";
import { Download, FileUp, Printer, Repeat, WalletCards, Zap } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import type { CreditCard, Expense } from "@/types";

export interface CardInvoiceExpensesFeedProps {
  monthLabelStr: string;
  competenceExpenses: Expense[];
  installments: Expense[];
  regular: Expense[];
  selectedCard: CreditCard | null;
  onOpenImport: () => void;
  onOpenPrint: () => void;
  onExportCsv: () => void;
  renderInvoiceRow: (expense: Expense) => ReactNode;
}

export function CardInvoiceExpensesFeed({
  monthLabelStr,
  competenceExpenses,
  installments,
  regular,
  selectedCard,
  onOpenImport,
  onOpenPrint,
  onExportCsv,
  renderInvoiceRow,
}: CardInvoiceExpensesFeedProps) {
  return (
    <section aria-label={`Despesas da fatura de ${monthLabelStr}`} className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-col gap-2.5 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Despesas · {monthLabelStr}
          </h2>
          <span className="text-xs text-muted-foreground font-mono sm:hidden">
            {competenceExpenses.length} {competenceExpenses.length === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
            {competenceExpenses.length} {competenceExpenses.length === 1 ? "item" : "itens"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenImport}
            disabled={!selectedCard}
            className="gap-1.5 flex-1 sm:flex-none justify-center"
          >
            <FileUp className="size-3.5" aria-hidden="true" />
            <span>Importar<span className="hidden sm:inline"> fatura</span></span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenPrint}
            disabled={competenceExpenses.length === 0 || !selectedCard}
            className="gap-1.5 flex-1 sm:flex-none justify-center"
          >
            <Printer className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Imprimir / Salvar </span>PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={competenceExpenses.length === 0 || !selectedCard}
            className="gap-1.5 flex-1 sm:flex-none justify-center"
          >
            <Download className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Exportar </span>CSV
          </Button>
        </div>
      </div>

      {competenceExpenses.length === 0 ? (
        <div data-tour="cards-installments-section">
          <EmptyState
            icon={<WalletCards className="size-6" aria-hidden="true" />}
            title="Sem despesas nesta fatura"
            description="As compras no cartão aparecem aqui de acordo com o fechamento da fatura."
            className="py-10 sm:py-12 px-4"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-7">
          {/* Parceladas — compras herdadas de meses anteriores (topo) */}
          <div data-tour="cards-installments-section" className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-0.5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Repeat className="size-3.5" aria-hidden="true" />
                Parceladas
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {installments.length} {installments.length === 1 ? "item" : "itens"}
              </span>
            </div>
            {installments.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface/50 py-5 px-4 text-center text-xs text-muted-foreground">
                Nenhuma compra parcelada nesta fatura.
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:gap-2.5">
                {installments.map(renderInvoiceRow)}
              </div>
            )}
          </div>

          {/* À vista — gastos do próprio mês da fatura (abaixo) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-0.5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Zap className="size-3.5" aria-hidden="true" />
                À vista
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {regular.length} {regular.length === 1 ? "item" : "itens"}
              </span>
            </div>
            {regular.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface/50 py-5 px-4 text-center text-xs text-muted-foreground">
                Nenhuma compra à vista nesta fatura.
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:gap-2.5">
                {regular.map(renderInvoiceRow)}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
