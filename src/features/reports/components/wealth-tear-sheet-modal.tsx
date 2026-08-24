import { usePrint } from "@/components/ui";
import { Layers, PieChart, Printer, ShieldAlert, TrendingUp } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { PrintSheet } from "@/components/ui/print-sheet";
import { numberToCents } from "@/domain/money";
import { formatSignedPct } from "@/services/masks/percent";
import type { AllocationAnalysisResult, ConcentrationRiskResult } from "@/domain/reports";

export interface WealthPositionRow {
  ticker: string;
  name?: string | null;
  assetClass: string;
  currency: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  valueBRL: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct: number;
  yearDividendsBRL: number;
  yocPct: number;
  isCash?: boolean;
}

export interface WealthTearSheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly WealthPositionRow[];
  totalBRL: number;
  totalCostBRL: number;
  cashBRL?: number;
  yearDividendsBRL?: number;
  allocationAnalysis: AllocationAnalysisResult;
  concentrationRisk: ConcentrationRiskResult;
  periodLabel?: string;
  appName?: string;
}

const formatQuantity = (quantity: number): string =>
  Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

export function WealthTearSheetModal({
  open,
  onOpenChange,
  rows,
  totalBRL,
  totalCostBRL,
  allocationAnalysis,
  concentrationRisk,
  periodLabel = "Posição Atual Consolidada",
  appName = "Finanças Pessoais",
}: WealthTearSheetModalProps) {
  const { printing, triggerPrint } = usePrint();
  const generatedAt = new Date().toLocaleDateString("pt-BR");
  const investmentRows = rows.filter((r) => !r.isCash);
  const unrealizedPnlBRL = totalBRL - totalCostBRL;
  const unrealizedPnlPct = totalCostBRL > 0 ? (unrealizedPnlBRL / totalCostBRL) * 100 : 0;


  const reportContent = (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* Cabeçalho Institucional do Dossiê */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4 print:flex-row print:items-start">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
            <TrendingUp className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-foreground">{appName}</span>
            <span className="text-xs text-muted-foreground">Dossiê Executivo de Alocação &amp; Patrimônio</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground print:items-end print:text-right">
          <span className="font-medium text-foreground">{periodLabel}</span>
          <span>Emitido em {generatedAt}</span>
        </div>
      </header>

      {/* Grade de KPIs Executivos */}
      <section aria-label="Indicadores de patrimônio" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Patrimônio Total</span>
          <MoneyText cents={numberToCents(totalBRL)} tone="portfolio" className="text-base sm:text-lg font-bold" />
        </div>
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Capital Investido (Custo)</span>
          <MoneyText cents={numberToCents(totalCostBRL)} tone="default" className="text-base sm:text-lg font-bold" />
        </div>
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Resultado Não Realizado</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <MoneyText cents={numberToCents(unrealizedPnlBRL)} tone={unrealizedPnlBRL >= 0 ? "positive" : "negative"} className="text-sm sm:text-base font-bold" />
            <span className={`text-xs font-semibold ${unrealizedPnlBRL >= 0 ? "text-positive-strong" : "text-critical"}`}>
              ({formatSignedPct(unrealizedPnlPct)})
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Aderência às Metas</span>
          <span className="num text-base sm:text-lg font-bold text-foreground">{allocationAnalysis.alignmentScore}%</span>
        </div>
      </section>

      {/* Seção 1: Matriz de Rebalanceamento (Metas vs. Posição Atual) */}
      <section aria-label="Matriz de Rebalanceamento" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <PieChart className="size-4 text-portfolio" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Diagnóstico de Alocação por Classe (Target vs. Actual)</h3>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                <th className="py-2.5 px-3">Classe</th>
                <th className="py-2.5 px-3 text-right">Atual (R$)</th>
                <th className="py-2.5 px-3 text-right">Atual (%)</th>
                <th className="py-2.5 px-3 text-right">Meta (%)</th>
                <th className="py-2.5 px-3 text-right">Gap (R$)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {allocationAnalysis.classGaps.map((cg) => (
                <tr key={cg.assetClass} className="hover:bg-surface-hover/30">
                  <td className="py-2 px-3 font-medium capitalize text-foreground">{cg.assetClass}</td>
                  <td className="py-2 px-3 text-right font-mono"><MoneyText cents={numberToCents(cg.currentBRL)} /></td>
                  <td className="py-2 px-3 text-right font-mono">{cg.currentPct.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right font-mono">{cg.targetPct > 0 ? `${cg.targetPct.toFixed(1)}%` : "—"}</td>
                  <td className="py-2 px-3 text-right font-mono">
                    <span className={cg.gapBRL > 0 ? "text-primary-strong font-semibold" : cg.gapBRL < 0 ? "text-muted-foreground" : ""}>
                      {cg.gapBRL > 0 ? `+ R$ ${cg.gapBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        cg.status === "deficit"
                          ? "bg-primary/10 text-primary-strong border border-primary/20"
                          : cg.status === "surplus"
                            ? "bg-surface-hover text-muted-foreground border border-border"
                            : "bg-positive/10 text-positive-strong border border-positive/20"
                      }`}
                    >
                      {cg.status === "deficit" ? "Aportar" : cg.status === "surplus" ? "Acima da Meta" : "Equilibrado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Seção 2: Risco de Concentração e Exposição Cambial */}
      <section aria-label="Risco e Concentração" className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ShieldAlert className="size-3.5 text-portfolio" aria-hidden="true" />
            <span>Concentração de Carteira</span>
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Top 5 Ativos mais representativos:</span>
              <span className="font-mono font-semibold text-foreground">{concentrationRisk.top5Pct.toFixed(1)}%</span>
            </div>
            {concentrationRisk.singleAssetDominance ? (
              <div className="flex justify-between">
                <span>Maior ativo ({concentrationRisk.singleAssetDominance.ticker}):</span>
                <span className="font-mono font-semibold text-foreground">{concentrationRisk.singleAssetDominance.pct.toFixed(1)}%</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Layers className="size-3.5 text-positive-strong" aria-hidden="true" />
            <span>Exposição Geográfica / Cambial</span>
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Brasil (BRL):</span>
              <span className="font-mono font-semibold text-foreground">{concentrationRisk.currencyExposure.brlPct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Internacional (Dólar / USD):</span>
              <span className="font-mono font-semibold text-foreground">{concentrationRisk.currencyExposure.usdPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Seção 3: Parecer Técnico da Consultoria */}
      {allocationAnalysis.topDeficitClass || concentrationRisk.riskAlerts.length > 0 ? (
        <section aria-label="Parecer da consultoria" className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-strong">Parecer do Consultor Patrimonial</span>
          <div className="flex flex-col gap-1.5 text-xs text-foreground/90">
            {allocationAnalysis.topDeficitClass ? (
              <p>
                <strong>Prioridade de Aporte:</strong> A classe <strong>{allocationAnalysis.topDeficitClass.assetClass.toUpperCase()}</strong> está com a maior defasagem patrimonial, demandando aproximadamente <strong>R$ {allocationAnalysis.topDeficitClass.gapBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> para restabelecer o equilíbrio das suas metas.
              </p>
            ) : (
              <p>Sua carteira está altamente alinhada com as metas planejadas. Mantenha a disciplina de aportes regulares.</p>
            )}
            {concentrationRisk.riskAlerts.map((alert) => (
              <p key={alert.code} className="text-muted-foreground">
                • {alert.message}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* Seção 4: Detalhamento Completo da Custódia de Ativos */}
      <section aria-label="Custódia de Ativos" className="flex flex-col gap-3 pt-2">
        <h3 className="text-sm font-semibold text-foreground">Custódia Consolidada de Ativos ({investmentRows.length})</h3>
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                <th className="py-2.5 px-3">Ticker</th>
                <th className="py-2.5 px-3">Classe</th>
                <th className="py-2.5 px-3 text-right">Qtd</th>
                <th className="py-2.5 px-3 text-right">Preço Médio</th>
                <th className="py-2.5 px-3 text-right">Cotação</th>
                <th className="py-2.5 px-3 text-right">Total (R$)</th>
                <th className="py-2.5 px-3 text-right">PnL (%)</th>
                <th className="py-2.5 px-3 text-right">YoC (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {investmentRows.map((r) => (
                <tr key={r.ticker} className="hover:bg-surface-hover/30">
                  <td className="py-2 px-3 font-semibold text-foreground">{r.ticker}</td>
                  <td className="py-2 px-3 capitalize text-muted-foreground">{r.assetClass}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatQuantity(r.quantity)}</td>
                  <td className="py-2 px-3 text-right font-mono"><MoneyText cents={numberToCents(r.averagePrice)} /></td>
                  <td className="py-2 px-3 text-right font-mono"><MoneyText cents={numberToCents(r.currentPrice)} /></td>
                  <td className="py-2 px-3 text-right font-mono font-medium text-foreground"><MoneyText cents={numberToCents(r.valueBRL)} /></td>
                  <td className={`py-2 px-3 text-right font-mono font-semibold ${r.unrealizedPnlPct >= 0 ? "text-positive-strong" : "text-critical"}`}>
                    {formatSignedPct(r.unrealizedPnlPct)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-positive-strong font-medium">
                    {r.yocPct > 0 ? `${r.yocPct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rodapé da Página A4 */}
      <footer className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
        <span>{appName} — Relatórios de Gestão Patrimonial</span>
        <span>Página 1 de 1</span>
      </footer>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Dossiê Executivo de Alocação &amp; Carteira"
        description="Visualização em padrão A4 de consultoria patrimonial, com diagnóstico de metas e risco."
        size="xl"
      >
        <div className="flex flex-col gap-6">
          <div className="p-4 sm:p-6 bg-surface rounded-xl border border-border">
            {reportContent}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button type="button" variant="default" onClick={triggerPrint} className="gap-2">
              <Printer className="size-4" aria-hidden="true" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </Modal>

      <PrintSheet open={printing}>
        {reportContent}
      </PrintSheet>
    </>
  );
}
