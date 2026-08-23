import { useEffect, useRef, useState } from "react";
import { Coins, LineChart, PieChart, Plus, RefreshCw, Shield, TrendingUp } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, SkeletonKpi } from "@/components/ui";
import { CategoryDonut, CashKpiCard, DeltaHint, KpiCard, PositionTable } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { calculatePortfolioConcentration, isCashAssetClass } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import {
  useDeletePortfolioAsset,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
  useSyncQuotes,
} from "@/state";
import {
  AssetDetailSheet,
  AssetEditDialog,
  CashFormDialog,
  ContributionsListDialog,
  ManualPriceDialog,
  PortfolioImportDialog,
} from "../components";
import { InvestmentWizard } from "../wizard";
import type { WizardMode } from "../wizard/wizard-state";
import type { AssetCurrency, PortfolioAsset } from "@/types";
import type { PriceSource } from "@/domain/portfolio";

/**
 * Resumo da carteira (§F36 e §F41 unificada) — Posição Consolidada + Investment Wizard (Modelo B) + Visão Dedicada:
 * KPIs executivos, gráfico unificado de distribuição da carteira, tabela de posições com Sheet de detalhes,
 * e Investment Wizard (Nova Operação centralizada: Compra, Venda, Provento, Split e Novo Ativo).
 */
export function ResumoTab() {
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const dividendsQuery = usePortfolioDividends();
  const deleteAsset = useDeletePortfolioAsset();
  const syncQuotes = useSyncQuotes();
  const autoSyncedRef = useRef(false);

  // FAB contextual mobile (?novo=investimento) e abertura do Wizard
  const { open: wizardDeepOpen, setOpen: setWizardDeepOpen } = useCreateDeepLink("investimento");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialAsset, setWizardInitialAsset] = useState<PortfolioAsset | null>(null);
  const [wizardInitialMode, setWizardInitialMode] = useState<WizardMode>("select");

  const isWizardOpen = wizardOpen || wizardDeepOpen;
  const handleWizardOpenChange = (next: boolean) => {
    setWizardOpen(next);
    setWizardDeepOpen(next);
    if (!next) {
      setWizardInitialAsset(null);
      setWizardInitialMode("select");
    }
  };

  const [detailAsset, setDetailAsset] = useState<PortfolioAsset | null>(null);
  const [assetEditing, setAssetEditing] = useState<PortfolioAsset | null>(null);

  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<PortfolioAsset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [contributionsOpen, setContributionsOpen] = useState(false);
  const [allocationMode, setAllocationMode] = useState<"asset" | "class">("class");
  const [priceFor, setPriceFor] = useState<{
    id: string;
    ticker: string;
    currency: AssetCurrency;
    priceBRL: number;
    source: PriceSource;
  } | null>(null);

  const rows = position.rows;
  const investmentRows = rows.filter((r) => !r.isCash);
  const cashAsset = (assetsQuery.data ?? []).find(
    (a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA",
  );
  const hasInvestments = rows.length > 0;

  // Auto-sincronização inicial para ativos que ainda não possuem cotação em cache
  useEffect(() => {
    if (autoSyncedRef.current || assetsQuery.isLoading || !assetsQuery.data) return;
    const assetsWithoutQuote = (assetsQuery.data ?? []).filter((a) => {
      if (isCashAssetClass(a.asset_class)) return false;
      const row = rows.find((r) => r.assetId === a.id);
      return !row || (row.source === "fallback" && row.priceBRL <= 0);
    });

    if (assetsWithoutQuote.length > 0) {
      autoSyncedRef.current = true;
      syncQuotes.mutate(assetsWithoutQuote);
    }
  }, [assetsQuery.data, assetsQuery.isLoading, rows, syncQuotes]);

  const assetById = (assetId: string): PortfolioAsset | undefined =>
    (assetsQuery.data ?? []).find((a) => a.id === assetId);

  const openDetail = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) {
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        setCashDialogOpen(true);
      } else {
        setDetailAsset(asset);
      }
    }
  };

  const openWizardForAsset = (assetId: string, mode: WizardMode = "buy") => {
    const asset = assetById(assetId);
    if (asset) {
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        setCashDialogOpen(true);
      } else {
        setWizardInitialAsset(asset);
        setWizardInitialMode(mode);
        setWizardOpen(true);
      }
    }
  };

  const openEdit = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) {
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        setCashDialogOpen(true);
      } else {
        setAssetEditing(asset);
      }
    }
  };

  const openDelete = (assetId: string) => {
    const asset = assetById(assetId);
    if (asset) setAssetToDelete(asset);
  };

  const month = currentMonth();

  // Proventos do mês a partir de portfolio_dividends
  const dividendsThisMonth = (dividendsQuery.data ?? [])
    .filter((d) => d.date.startsWith(month))
    .reduce((acc, d) => acc + d.amount, 0);
  const dividendsCents = numberToCents(dividendsThisMonth);

  // Agrupamento por classe de ativos
  const classMap = new Map<string, number>();
  for (const row of rows) {
    const label = row.assetClass?.trim() || (row.isCash ? "Caixa" : "Sem classe");
    const cents = Math.round(row.valueBRL * 100);
    classMap.set(label, (classMap.get(label) ?? 0) + cents);
  }
  const classSlices = Array.from(classMap.entries())
    .map(([label, valueCents]) => ({
      key: label,
      label,
      valueCents,
      subtitle: `${rows.filter((r) => (r.assetClass?.trim() || (r.isCash ? "Caixa" : "Sem classe")) === label).length} ativo(s)`,
    }))
    .filter((s) => s.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);

  // Fatias individuais de cada ativo com clique interativo para ver detalhes
  const assetSlices = rows
    .filter((row) => row.valueBRL > 0)
    .sort((a, b) => b.valueBRL - a.valueBRL)
    .map((row) => ({
      key: row.assetId,
      label: row.ticker,
      valueCents: Math.round(row.valueBRL * 100),
      subtitle: row.assetClass ?? (row.isCash ? "Caixa" : "Sem classe"),
      onClick: () => openDetail(row.assetId),
    }));

  const activeSlices = allocationMode === "asset" ? assetSlices : classSlices;

  const series = position.monthlySeries;
  const previousPoint = series.length > 1 ? series[series.length - 2] : undefined;
  const previousCents = previousPoint ? numberToCents(previousPoint.valueBRL) : 0;

  const unrealizedPnlBRL = position.totalBRL - position.totalCostBRL;
  const unrealizedPct =
    position.totalCostBRL > 0 ? (unrealizedPnlBRL / position.totalCostBRL) * 100 : null;

  // Termômetro de Concentração
  const concentration = calculatePortfolioConcentration(
    investmentRows.map((r) => ({
      assetId: r.assetId,
      ticker: r.ticker,
      valueBRL: r.valueBRL,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      {position.error ? (
        <Alert variant="error">{getErrorMessage(position.error)}</Alert>
      ) : null}

      {/* Grid de KPIs da Carteira */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {position.isLoading ? (
          <>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </>
        ) : (
          <>
            <KpiCard
              label="Patrimônio Total"
              cents={numberToCents(position.totalBRL)}
              hint={
                <DeltaHint
                  currentCents={numberToCents(position.totalBRL)}
                  previousCents={previousCents}
                />
              }
            />
            <KpiCard
              label="Rentabilidade Global"
              cents={numberToCents(unrealizedPnlBRL)}
              tone={unrealizedPnlBRL >= 0 ? "positive" : "negative"}
              hint={
                unrealizedPct != null
                  ? `${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(2)}% sobre o custo total`
                  : undefined
              }
            />
            <KpiCard
              label="Proventos deste Mês"
              cents={dividendsCents}
              tone={dividendsCents > 0 ? "positive" : "default"}
              hint="Dividendos / JCP / Rendimentos"
            />
            <CashKpiCard
              cashBRL={position.cashBRL}
              cashPct={position.totalBRL > 0 ? (position.cashBRL / position.totalBRL) * 100 : 0}
              hasCashAsset={Boolean(cashAsset)}
              onEdit={() => setCashDialogOpen(true)}
              onDelete={() => {
                if (cashAsset) setAssetToDelete(cashAsset);
              }}
            />
          </>
        )}
      </div>

      {/* Alerta de Concentração Elevada */}
      {concentration.isConcentrated && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-negative/30 bg-negative/5 p-4 text-xs text-foreground shadow-xs">
          <Shield className="size-4 shrink-0 text-negative-strong mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-negative-strong">Alerta de Concentração na Carteira</span>
            <span className="text-muted-foreground">
              Seu maior ativo ({concentration.concentratedAssets[0]?.ticker}) representa{" "}
              <strong className="font-mono text-foreground">
                {concentration.concentratedAssets[0]?.pct.toFixed(1)}%
              </strong>{" "}
              do patrimônio investido. Considere diversificar nos próximos aportes.
            </span>
          </div>
        </div>
      )}

      {/* Estado Vazio de Investimentos */}
      {!position.isLoading && !hasInvestments && (
        <EmptyState
          icon={<TrendingUp className="size-6" />}
          title="Nenhum ativo cadastrado"
          headingLevel="h2"
          description="Adicione seus investimentos ou registre seu saldo em caixa para iniciar o acompanhamento patrimonial."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setWizardInitialAsset(null);
                  setWizardInitialMode("select");
                  setWizardOpen(true);
                }}
              >
                <Plus aria-hidden="true" className="size-4" />
                Nova Operação
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setCashDialogOpen(true)}>
                Cadastrar Saldo em Caixa
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                Importar Carteira
              </Button>
            </div>
          }
        />
      )}

      {/* Conteúdo com Ativos Cadastrados */}
      {!position.isLoading && hasInvestments && (
        <>
          {/* Seção Gráfica: Alocação Visual */}
          <section aria-label="Alocação da Carteira" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <PieChart className="size-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Distribuição Patrimonial</h2>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <div className="inline-flex rounded-lg border border-border/80 bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setAllocationMode("class")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      allocationMode === "class"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Por Classe
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode("asset")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      allocationMode === "asset"
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Por Ativo
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <CategoryDonut
                slices={activeSlices}
                totalCents={numberToCents(position.totalBRL)}
                className="w-full max-w-full"
              />
            </div>
          </section>

          {/* Seção de Custódia e Posição Atual */}
          <section aria-label="Posições da Carteira" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <TrendingUp className="size-3.5" aria-hidden="true" />
                </span>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">Posição Consolidada</h2>
                  <Badge variant="muted" className="text-[11px] font-mono">
                    {investmentRows.length} ativo(s)
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => syncQuotes.mutate(assetsQuery.data ?? [])}
                  disabled={syncQuotes.isPending}
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
                  title="Atualizar cotações de mercado via API"
                  aria-label="Atualizar cotações"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`size-3.5 ${syncQuotes.isPending ? "animate-spin" : ""}`}
                  />
                  <span className="hidden md:inline">{syncQuotes.isPending ? "Atualizando…" : "Atualizar"}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContributionsOpen(true)}
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
                  title="Gerenciar lançamentos de aportes financeiros do mês"
                  aria-label="Gerenciar aportes do mês"
                >
                  <Coins aria-hidden="true" className="size-3.5 text-portfolio" />
                  <span className="hidden md:inline">Aportes</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1 shrink-0"
                  onClick={() => {
                    setWizardInitialAsset(null);
                    setWizardInitialMode("select");
                    setWizardOpen(true);
                  }}
                  title="Nova operação em investimentos"
                  aria-label="Nova operação em investimentos"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">Nova Operação</span>
                </Button>
              </div>
            </div>

            <PositionTable
              rows={investmentRows}
              sortable
              onListTransactions={openDetail}
              onRegisterTransaction={(assetId) => openWizardForAsset(assetId, "buy")}
              onEditAsset={openEdit}
              onSplitAsset={(assetId) => openWizardForAsset(assetId, "split")}
              onSetManualPrice={(assetId, ticker, currency, priceBRL, source) => {
                setPriceFor({ id: assetId, ticker, currency, priceBRL, source });
              }}
              onDeleteAsset={openDelete}
            />
          </section>

          {/* Seção de Evolução Patrimonial (Snapshots Mensais) */}
          <section aria-label="Evolução Patrimonial" className="rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
                  <LineChart className="size-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Evolução Histórica (Snapshots Mensais)</h2>
              </div>
              <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
              {series.map((point) => {
                const isCurrent = point.month === month;
                const gain = point.valueBRL - point.costBRL;
                const gainPct = point.costBRL > 0 ? (gain / point.costBRL) * 100 : 0;
                return (
                  <div
                    key={point.month}
                    className={`rounded-xl border p-3 flex flex-col gap-1 transition-colors ${
                      isCurrent
                        ? "border-portfolio/40 bg-portfolio/5"
                        : "border-border/60 bg-surface-hover/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{point.month}</span>
                      {isCurrent ? <Badge variant="portfolio" className="text-[10px] px-1.5 py-0">atual</Badge> : null}
                    </div>
                    <MoneyText cents={numberToCents(point.valueBRL)} tone="default" className="text-sm font-semibold" />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>Custo</span>
                      <MoneyText cents={numberToCents(point.costBRL)} tone="default" className="text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Resultado</span>
                      <span className={`num font-medium ${gain >= 0 ? "text-positive-strong" : "text-negative-strong"}`}>
                        {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Investment Wizard Unificado (Modelo B) */}
      <InvestmentWizard
        open={isWizardOpen}
        onOpenChange={handleWizardOpenChange}
        initialAsset={wizardInitialAsset}
        initialMode={wizardInitialMode}
      />

      {/* Asset Detail Sheet (Visão Dedicada) */}
      <AssetDetailSheet
        open={detailAsset !== null}
        onOpenChange={(open) => !open && setDetailAsset(null)}
        asset={detailAsset}
        onAction={(action, asset) => {
          setDetailAsset(null);
          const mode: WizardMode =
            action === "sell" || action === "dividend" || action === "split" ? action : "buy";
          openWizardForAsset(asset.id, mode);
        }}
      />

      {/* Diálogo de Edição Cadastral */}
      {assetEditing ? (
        <AssetEditDialog
          open={assetEditing !== null}
          onOpenChange={(open) => !open && setAssetEditing(null)}
          asset={assetEditing}
        />
      ) : null}

      <CashFormDialog
        open={cashDialogOpen}
        onOpenChange={setCashDialogOpen}
        asset={cashAsset ?? null}
      />

      {priceFor ? (
        <ManualPriceDialog
          key={priceFor.id}
          open={priceFor !== null}
          onOpenChange={(next) => !next && setPriceFor(null)}
          asset={priceFor}
        />
      ) : null}

      <PortfolioImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <ContributionsListDialog
        open={contributionsOpen}
        onOpenChange={setContributionsOpen}
      />

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        open={assetToDelete !== null}
        onOpenChange={(next) => !next && setAssetToDelete(null)}
        title={assetToDelete ? `Excluir ${assetToDelete.ticker}?` : "Excluir ativo?"}
        description="O ativo e suas metas de alocação serão removidos da carteira. A posição é recalculada automaticamente."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={() => {
          if (!assetToDelete) return;
          const assetId = assetToDelete.id;
          void Promise.resolve(deleteAsset.mutateAsync(assetId)).finally(() => setAssetToDelete(null));
        }}
      />
    </div>
  );
}
