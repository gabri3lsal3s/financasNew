import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  History,
  Layers,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  SkeletonTable,
} from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { currentMonth, formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { TransactionFormDialog } from "./transaction-form-dialog";
import {
  useAllPortfolioTransactions,
  useDeletePortfolioContribution,
  useDeletePortfolioDividend,
  useDeletePortfolioTransaction,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioPosition,
} from "@/state";
import type { PortfolioAsset, PortfolioContribution, PortfolioDividend, PortfolioTransaction } from "@/types";

export type ActivityFilterType = "all" | "buy" | "sell" | "dividend";

export interface ActivityItem {
  id: string;
  source: "transaction" | "contribution" | "dividend";
  type: "buy" | "sell" | "dividend" | "split" | "contribution";
  date: string;
  ticker: string;
  assetName?: string;
  assetClass?: string | null;
  quantity?: number;
  price?: number;
  total: number;
  notes?: string | null;
  rawTransaction?: PortfolioTransaction;
  rawContribution?: PortfolioContribution;
  rawDividend?: PortfolioDividend;
}

export interface PortfolioActivityPanelProps {
  defaultMonth?: string;
}

/**
 * Extrato Completo de Movimentações da Carteira.
 * Unifica compras/aportes, vendas/resgates, proventos e splits com filtros por tipo,
 * resumo de fluxo mensal e visualização de impacto financeiro.
 */
export function PortfolioActivityPanel({ defaultMonth }: PortfolioActivityPanelProps) {
  const [month, setMonth] = useState(() => defaultMonth ?? currentMonth());
  const [filterType, setFilterType] = useState<ActivityFilterType>("all");
  const [search, setSearch] = useState("");
  const [itemToDelete, setItemToDelete] = useState<ActivityItem | null>(null);
  const [editingTx, setEditingTx] = useState<{ transaction: PortfolioTransaction; asset: PortfolioAsset } | null>(null);

  const transactionsQuery = useAllPortfolioTransactions();
  const contributionsQuery = usePortfolioContributions();
  const dividendsQuery = usePortfolioDividends();
  const assetsQuery = usePortfolioAssets();
  const positionQuery = usePortfolioPosition();
  const usdRate = positionQuery.rows.find((r) => r.currency === "USD")?.usdRate ?? 5.25;

  const deleteTransaction = useDeletePortfolioTransaction();
  const deleteContribution = useDeletePortfolioContribution();
  const deleteDividend = useDeletePortfolioDividend();

  const assetMap = useMemo(
    () => new Map((assetsQuery.data ?? []).map((a) => [a.id, a])),
    [assetsQuery.data],
  );

  // Unifica todas as movimentações em uma timeline padronizada
  const allActivities = useMemo(() => {
    const list: ActivityItem[] = [];

    // 1. Transações do Ledger (Compras, Vendas, Splits, etc.)
    for (const t of transactionsQuery.data ?? []) {
      const asset = assetMap.get(t.asset_id);
      const ticker = asset?.ticker ?? "Ativo";
      const totalAmount = t.total > 0 ? t.total : (t.quantity > 0 && t.price > 0 ? t.quantity * t.price : 0);

      list.push({
        id: `tx-${t.id}`,
        source: "transaction",
        type: t.type === "buy" ? "buy" : t.type === "sell" ? "sell" : t.type === "split" ? "split" : "buy",
        date: t.date,
        ticker,
        assetClass: asset?.asset_class,
        quantity: t.quantity,
        price: t.price,
        total: totalAmount,
        notes: undefined,
        rawTransaction: t,
      });
    }

    // 2. Proventos Recebidos (Dividendos, JCP, Rendimentos)
    for (const d of dividendsQuery.data ?? []) {
      const asset = d.asset_id ? assetMap.get(d.asset_id) : undefined;
      const ticker = asset?.ticker ?? "Provento";

      // Evita duplicar se a transação do provento já veio pelo ledger
      const alreadyInList = list.some(
        (item) => item.source === "transaction" && item.date === d.date && item.ticker === ticker && Math.abs(item.total - d.amount) < 0.01,
      );

      if (!alreadyInList) {
        list.push({
          id: `div-${d.id}`,
          source: "dividend",
          type: "dividend",
          date: d.date,
          ticker,
          assetClass: asset?.asset_class,
          total: d.amount,
          notes: d.notes,
          rawDividend: d,
        });
      }
    }

    // 3. Aportes Financeiros / Injeções de Capital
    for (const c of contributionsQuery.data ?? []) {
      const asset = c.asset_id ? assetMap.get(c.asset_id) : undefined;
      const ticker = asset?.ticker ?? "Aporte Financeiro";

      // Evita duplicar se a compra gerada pelo aporte já existe na lista
      const alreadyCovered = list.some(
        (item) =>
          item.source === "transaction" &&
          item.type === "buy" &&
          item.date === c.date &&
          (item.ticker === ticker || ticker === "Aporte Financeiro") &&
          Math.abs(item.total - c.amount) < 0.01,
      );

      if (!alreadyCovered) {
        list.push({
          id: `contrib-${c.id}`,
          source: "contribution",
          type: "contribution",
          date: c.date,
          ticker,
          assetClass: asset?.asset_class,
          total: c.amount,
          notes: c.notes,
          rawContribution: c,
        });
      }
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactionsQuery.data, contributionsQuery.data, dividendsQuery.data, assetMap]);

  // Filtro por Mês
  const monthActivities = useMemo(
    () => allActivities.filter((item) => item.date.startsWith(month)),
    [allActivities, month],
  );

  // Métricas do Mês
  const monthStats = useMemo(() => {
    let totalBought = 0;
    let totalSold = 0;
    let totalDividends = 0;

    for (const item of monthActivities) {
      const asset = item.rawTransaction
        ? assetMap.get(item.rawTransaction.asset_id)
        : item.rawDividend?.asset_id
          ? assetMap.get(item.rawDividend.asset_id)
          : null;
      const isUSD = asset?.currency === "USD";
      const rate = isUSD ? usdRate : 1;
      const totalBRL = item.total * rate;

      if (item.type === "buy" || item.type === "contribution") {
        totalBought += totalBRL;
      } else if (item.type === "sell") {
        totalSold += totalBRL;
      } else if (item.type === "dividend") {
        totalDividends += totalBRL;
      }
    }

    const netFlow = totalBought + totalDividends - totalSold;

    return {
      boughtCents: numberToCents(totalBought),
      soldCents: numberToCents(totalSold),
      dividendsCents: numberToCents(totalDividends),
      netFlowCents: numberToCents(netFlow),
    };
  }, [monthActivities, assetMap, usdRate]);

  // Filtros de Tipo e Busca
  const filteredActivities = useMemo(() => {
    return monthActivities.filter((item) => {
      if (filterType === "buy" && item.type !== "buy" && item.type !== "contribution") return false;
      if (filterType === "sell" && item.type !== "sell") return false;
      if (filterType === "dividend" && item.type !== "dividend") return false;

      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchTicker = item.ticker.toLowerCase().includes(query);
        const matchNotes = item.notes?.toLowerCase().includes(query) ?? false;
        const matchClass = item.assetClass?.toLowerCase().includes(query) ?? false;
        return matchTicker || matchNotes || matchClass;
      }

      return true;
    });
  }, [monthActivities, filterType, search]);

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.source === "transaction" && itemToDelete.rawTransaction) {
        await deleteTransaction.mutateAsync(itemToDelete.rawTransaction.id);
      } else if (itemToDelete.source === "contribution" && itemToDelete.rawContribution) {
        await deleteContribution.mutateAsync(itemToDelete.rawContribution);
      } else if (itemToDelete.source === "dividend" && itemToDelete.rawDividend) {
        await deleteDividend.mutateAsync(itemToDelete.rawDividend.id);
      }

      triggerSensory("destructive");
      pushToast({
        title: "Lançamento excluído",
        description: "A movimentação foi removida e os saldos recalculados.",
      });
      setItemToDelete(null);
    } catch (err) {
      pushToast({
        title: "Erro ao excluir movimentação",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const isLoading =
    transactionsQuery.isLoading ||
    contributionsQuery.isLoading ||
    dividendsQuery.isLoading ||
    assetsQuery.isLoading;

  return (
    <>
      <div className="flex flex-col gap-4">
        <MonthPicker value={month} onValueChange={setMonth} aria-label="Mês do extrato" />

        {/* Resumo Consolidado de Fluxo no Mês */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface/90 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Aportes / Compras</span>
              <ArrowDownLeft className="size-3.5 text-positive-strong" aria-hidden="true" />
            </div>
            <span className="text-base font-semibold text-foreground">
              <MoneyText cents={monthStats.boughtCents} tone="default" />
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface/90 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Vendas / Resgates</span>
              <ArrowUpRight className="size-3.5 text-negative-strong" aria-hidden="true" />
            </div>
            <span className="text-base font-semibold text-foreground">
              <MoneyText cents={monthStats.soldCents} tone="default" />
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface/90 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Proventos</span>
              <Coins className="size-3.5 text-portfolio" aria-hidden="true" />
            </div>
            <span className="text-base font-semibold text-foreground">
              <MoneyText cents={monthStats.dividendsCents} tone="positive" />
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface/90 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Fluxo Líquido</span>
              <Layers className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </div>
            <span className="text-base font-semibold text-foreground">
              <MoneyText cents={monthStats.netFlowCents} tone="default" sign="auto" />
            </span>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="relative flex-1 w-full min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ativo ou observação…"
              aria-label="Buscar movimentações"
              className={cn("pl-8 w-full", search ? "pr-8" : "")}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 transition-colors"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                filterType === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
              )}
            >
              Todas ({monthActivities.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("buy")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                filterType === "buy"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
              )}
            >
              Aportes/Compras
            </button>
            <button
              type="button"
              onClick={() => setFilterType("sell")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                filterType === "sell"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
              )}
            >
              Vendas/Resgates
            </button>
            <button
              type="button"
              onClick={() => setFilterType("dividend")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                filterType === "dividend"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
              )}
            >
              Proventos
            </button>
          </div>
        </div>

        {/* Lista de Movimentações */}
        {isLoading ? (
          <SkeletonTable rows={4} />
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            icon={<History className="size-6" aria-hidden="true" />}
            title="Nenhuma movimentação registrada no período"
            description="Todas as suas compras, vendas, resgates de renda fixa e proventos aparecem aqui para conferência e auditoria completa."
            tone="portfolio"
            headingLevel="h3"
          />
        ) : (
          <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-surface/70">
            {filteredActivities.map((item) => {
              const isBuy = item.type === "buy" || item.type === "contribution";
              const isSell = item.type === "sell";
              const isDividend = item.type === "dividend";
              const isSplit = item.type === "split";
              const itemAsset = item.rawTransaction
                ? assetMap.get(item.rawTransaction.asset_id)
                : item.rawDividend?.asset_id
                  ? assetMap.get(item.rawDividend.asset_id)
                  : null;
              const itemCurrency = itemAsset?.currency ?? "BRL";

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3.5 hover:bg-surface-hover/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
                        isBuy && "bg-positive/10 text-positive-strong ring-positive/20",
                        isSell && "bg-destructive/10 text-critical-strong ring-destructive/20",
                        isDividend && "bg-portfolio/10 text-portfolio ring-portfolio/20",
                        isSplit && "bg-surface-hover text-muted-foreground ring-border/60",
                      )}
                    >
                      {isBuy ? (
                        <ArrowDownLeft className="size-4" aria-hidden="true" />
                      ) : isSell ? (
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      ) : isDividend ? (
                        <Coins className="size-4" aria-hidden="true" />
                      ) : (
                        <Layers className="size-4" aria-hidden="true" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          {item.ticker}
                        </span>
                        <Badge
                          variant={isBuy ? "positive" : isSell ? "critical" : isDividend ? "portfolio" : "muted"}
                          size="xs"
                        >
                          {isBuy ? "Compra" : isSell ? "Venda / Resgate" : isDividend ? "Provento" : "Split"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{formatDateBR(item.date)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                        {item.quantity && item.quantity > 0 && item.price && item.price > 0 ? (
                          <span>
                            {item.quantity} un @ <MoneyText cents={numberToCents(item.price)} currency={itemCurrency} tone="default" />
                          </span>
                        ) : null}
                        {item.notes ? <span>• {item.notes}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex flex-col items-end mr-1">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isBuy && "text-foreground",
                          isSell && "text-critical-strong",
                          isDividend && "text-positive-strong",
                        )}
                      >
                        <MoneyText cents={numberToCents(item.total)} currency={itemCurrency} sign={isSell ? "explicit" : "auto"} />
                      </span>
                    </div>

                    {item.source === "transaction" && item.rawTransaction && assetMap.get(item.rawTransaction.asset_id) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const asset = assetMap.get(item.rawTransaction!.asset_id);
                          if (asset) {
                            setEditingTx({ transaction: item.rawTransaction!, asset });
                          }
                        }}
                        className="size-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Editar movimentação"
                        aria-label={`Editar movimentação de ${item.ticker}`}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItemToDelete(item)}
                      className="size-7 p-0 text-muted-foreground hover:text-negative-strong"
                      title="Excluir movimentação"
                      aria-label={`Excluir movimentação de ${item.ticker}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={itemToDelete !== null}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Excluir movimentação?"
        description={`O lançamento de ${itemToDelete?.ticker ?? ""} no valor de R$ ${itemToDelete?.total.toFixed(2) ?? ""} será excluído permanentemente.`}
        confirmLabel="Excluir movimentação"
        variant="destructive"
        confirmPending={deleteTransaction.isPending || deleteContribution.isPending || deleteDividend.isPending}
        onConfirm={handleDeleteItem}
      />

      {editingTx && (
        <TransactionFormDialog
          open={editingTx !== null}
          onOpenChange={(open) => !open && setEditingTx(null)}
          asset={editingTx.asset}
          transaction={editingTx.transaction}
        />
      )}
    </>
  );
}
