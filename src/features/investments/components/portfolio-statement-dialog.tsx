import { useState, useMemo } from "react";
import { ListFilter, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, Input, Modal, PrintSheet, SkeletonTable, usePrint } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { ReportHeader, ReportFooter } from "@/components/modules/reports";
import { useAllPortfolioTransactions, useDeletePortfolioTransaction, usePortfolioAssets } from "@/state";
import { PORTFOLIO_TX_LABELS } from "@/lib/labels";
import { numberToCents } from "@/domain/money";
import { formatDateBR } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import { TransactionFormDialog } from "./transaction-form-dialog";

import type { PortfolioAsset, PortfolioTransaction } from "@/types";

export interface PortfolioStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewTransaction?: () => void;
}

const formatQty = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

export function PortfolioStatementDialog({ open, onOpenChange, onNewTransaction }: PortfolioStatementDialogProps) {
  const { printing, triggerPrint } = usePrint("Extrato_Consolidado_Investimentos.pdf");
  const transactionsQuery = useAllPortfolioTransactions();
  const assetsQuery = usePortfolioAssets();
  const deleteTx = useDeletePortfolioTransaction();

  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [editing, setEditing] = useState<PortfolioTransaction | null>(null);
  const [deleting, setDeleting] = useState<PortfolioTransaction | null>(null);

  const rawAssets = assetsQuery.data;
  const assetMap = useMemo(() => new Map((rawAssets ?? []).map((a) => [a.id, a])), [rawAssets]);

  const rawTransactions = transactionsQuery.data;

  const filteredTransactions = useMemo(() => {
    return (rawTransactions ?? [])
      .filter((tx) => {
        const asset = assetMap.get(tx.asset_id);
        const ticker = asset?.ticker ?? "";

        if (search.trim() && !ticker.toLowerCase().includes(search.trim().toLowerCase())) {
          return false;
        }

        if (selectedType === "buys" && tx.type !== "buy" && tx.type !== "subscription") return false;
        if (selectedType === "sells" && tx.type !== "sell") return false;
        if (selectedType === "dividends" && tx.type !== "dividend" && tx.type !== "jcp" && tx.type !== "fii_yield") return false;
        if (selectedType === "splits" && tx.type !== "split" && tx.type !== "reverse_split") return false;

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  }, [rawTransactions, assetMap, search, selectedType]);


  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTx.mutateAsync(deleting);
      triggerSensory("destructive");
    } catch {
      // Toast disparado pelo hook
    } finally {
      setDeleting(null);
    }
  };

  const editingAsset: PortfolioAsset | null = editing ? assetMap.get(editing.asset_id) ?? null : null;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Extrato Consolidado da Carteira"
        description="Histórico cronológico de todas as compras, vendas, proventos e desdobramentos de todos os seus ativos."
        size="3xl"
        headerActions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => triggerPrint()}
            disabled={printing || filteredTransactions.length === 0}
            className="gap-1.5 h-8 text-xs px-2.5 print:hidden"
          >
            <Printer className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{printing ? "Preparando..." : "Imprimir / Salvar PDF"}</span>
            <span className="sm:hidden">{printing ? "..." : "PDF"}</span>
          </Button>
        }
      >
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar por ticker…"
                aria-label="Filtrar lançamentos por ticker"
                className="pl-8 pr-8 text-xs"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { key: "all", label: "Todos" },
                { key: "buys", label: "Compras" },
                { key: "sells", label: "Vendas" },
                { key: "dividends", label: "Proventos" },
                { key: "splits", label: "Splits" },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setSelectedType(filter.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    selectedType === filter.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-hover/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
            <Badge variant="muted" className="text-[11px]">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? "lançamento encontrado" : "lançamentos encontrados"}
            </Badge>
            {onNewTransaction ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onNewTransaction}
                className="text-xs"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Novo Lançamento
              </Button>
            ) : null}
          </div>

          {transactionsQuery.isLoading ? (
            <SkeletonTable rows={5} />
          ) : filteredTransactions.length === 0 ? (
            <EmptyState
              icon={<ListFilter className="size-6" aria-hidden="true" />}
              title="Nenhum lançamento encontrado"
              description={
                search || selectedType !== "all"
                  ? "Nenhuma transação corresponde aos filtros selecionados."
                  : "Nenhuma operação registrada na carteira até o momento."
              }
              tone="portfolio"
              headingLevel="h2"
            />
          ) : (
            <div className="max-h-[380px] overflow-y-auto rounded-xl border border-border/80">
              <ul className="flex flex-col divide-y divide-border/70">
                {filteredTransactions.map((tx) => {
                  const asset = assetMap.get(tx.asset_id);
                  const isDividend = tx.type === "dividend" || tx.type === "jcp" || tx.type === "fii_yield";
                  const isSplit = tx.type === "split" || tx.type === "reverse_split";
                  const currency = asset?.currency ?? "BRL";

                  return (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-hover/60"
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(tx)}
                        className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                        aria-label={`Editar lançamento de ${asset?.ticker ?? ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {asset?.ticker ?? "Ativo"}
                          </span>
                          <Badge variant={tx.type === "buy" ? "positive" : tx.type === "sell" ? "negative" : "portfolio"}>
                            {PORTFOLIO_TX_LABELS[tx.type]}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{formatDateBR(tx.date)}</span>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          {isSplit ? (
                            <span className="text-muted-foreground">{formatQty(tx.quantity)}:1</span>
                          ) : isDividend ? (
                            <MoneyText cents={numberToCents(tx.total)} currency={currency} tone="positive" sign="none" />
                          ) : (
                            <>
                              <span className="text-muted-foreground">
                                {formatQty(tx.quantity)} × <MoneyText cents={numberToCents(tx.price)} currency={currency} tone="default" />
                              </span>
                              <MoneyText
                                cents={numberToCents(tx.total)}
                                currency={currency}
                                tone={tx.type === "buy" ? "default" : "positive"}
                                sign="none"
                              />
                            </>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-8 px-2"
                          aria-label={`Editar lançamento de ${asset?.ticker ?? ""}`}
                          onClick={() => setEditing(tx)}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-8 px-2 text-negative-strong hover:text-negative-strong"
                          aria-label={`Excluir lançamento de ${asset?.ticker ?? ""}`}
                          onClick={() => setDeleting(tx)}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {editing && editingAsset ? (
        <TransactionFormDialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          asset={editingAsset}
          transaction={editing}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Excluir lançamento?"
        description="Esta operação recalculará o custo médio e a posição deste ativo na sua carteira."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Portal de Impressão A4 Multi-página */}
      <PrintSheet open={open}>
        <div className="print-document flex flex-col gap-5 w-full bg-surface text-foreground">
          <ReportHeader
            title="Extrato Consolidado da Carteira"
            subtitle="Histórico cronológico de movimentações e eventos societários"
            periodLabel={`${filteredTransactions.length} lançamentos`}
            icon={ListFilter}
          />

          <div className="rounded-lg border border-border/80 overflow-x-auto print:overflow-visible shadow-2xs">
            <table className="w-full text-left text-xs border-collapse print:table-fixed">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-3 font-bold print:w-[15%]">Data</th>
                  <th className="py-2 px-3 font-bold print:w-[15%]">Tipo</th>
                  <th className="py-2 px-3 font-bold print:w-[15%]">Ticker</th>
                  <th className="py-2 px-3 font-bold text-right print:w-[15%]">Quantidade</th>
                  <th className="py-2 px-3 font-bold text-right print:w-[20%]">Preço Unit.</th>
                  <th className="py-2 px-3 font-bold text-right print:w-[20%]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTransactions.map((tx) => {
                  const asset = assetMap.get(tx.asset_id);
                  const isSplit = tx.type === "split";
                  return (
                    <tr key={tx.id} className="break-inside-avoid even:bg-muted/20 print:even:bg-slate-50/50">
                      <td className="py-1.5 px-3 font-mono text-muted-foreground">{formatDateBR(tx.date)}</td>
                      <td className="py-1.5 px-3 font-medium text-foreground">{PORTFOLIO_TX_LABELS[tx.type] ?? tx.type}</td>
                      <td className="py-1.5 px-3 font-mono font-bold text-foreground">{asset?.ticker ?? "—"}</td>
                      <td className="py-1.5 px-3 text-right num font-mono text-muted-foreground">
                        {isSplit ? `${formatQty(tx.quantity)}:1` : formatQty(tx.quantity)}
                      </td>
                      <td className="py-1.5 px-3 text-right num font-mono text-muted-foreground">
                        {isSplit ? "—" : <MoneyText cents={numberToCents(tx.price)} currency={asset?.currency} tone="default" />}
                      </td>
                      <td className="py-1.5 px-3 text-right font-semibold num font-mono text-foreground">
                        {isSplit ? "—" : <MoneyText cents={numberToCents(tx.total)} currency={asset?.currency} tone="default" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ReportFooter
            disclaimer="Extrato consolidado emitido para simples conferência e acompanhamento de custódia patrimonial."
          />
        </div>
      </PrintSheet>
    </>
  );
}
