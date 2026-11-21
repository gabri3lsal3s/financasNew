import { AlertCircle, Layers, SlidersHorizontal, TrendingUp } from "lucide-react";
import { Button, MoneyText } from "@/components/ui";
import {
  ReportClassTables,
  ReportExecutiveSummary,
  ReportFooter,
  ReportHeader,
  ReportMonthlyMovements,
  ReportRunningHeader,
} from "@/components/modules/reports";
import type { ReportClassGroup } from "@/components/modules/reports/report-class-tables";
import { numberToCents } from "@/domain/money";
import type { PointInTimeFidelity, PointInTimeResult } from "@/domain/portfolio/point-in-time";
import { OFFICIAL_CVM_DISCLAIMER } from "@/lib/institutional";
import { formatPercent, formatSignedPct } from "@/services/masks";

export interface ExecutiveReportDocumentProps {
  periodLabel: string;
  appName: string;
  accountHolder?: string;
  fidelity?: PointInTimeFidelity;
  monthlyData?: PointInTimeResult | null;
  effectiveTotalBRL: number;
  effectiveCostBRL: number;
  effectiveCashBRL: number;
  investmentCount: number;
  classGroups: ReportClassGroup[];
  pqs: number | null;
  onOpenClosing: () => void;
}

export function ExecutiveReportDocument({
  periodLabel,
  appName,
  accountHolder,
  fidelity,
  monthlyData,
  effectiveTotalBRL,
  effectiveCostBRL,
  effectiveCashBRL,
  investmentCount,
  classGroups,
  pqs,
  onOpenClosing,
}: ExecutiveReportDocumentProps) {
  const discrepancyPct = fidelity?.discrepancyPct;
  const showDiscrepancyAlert = Boolean(
    fidelity && discrepancyPct != null && Math.abs(discrepancyPct) > 3,
  );

  const stmt = monthlyData?.monthlyStatement;
  const monthRatePct = stmt?.monthRatePct ?? null;
  const monthNetPnlBRL = stmt?.monthNetPnlBRL ?? 0;
  const monthDividendsBRL =
    stmt?.monthDividendsBRL ?? monthlyData?.monthDividendsTotalBRL ?? 0;
  const isPositivePnl = monthNetPnlBRL >= 0;

  const hasCashGroup = classGroups.some((g) => {
    const norm = g.className.toLowerCase();
    return norm.includes("caixa") || norm.includes("liquidez");
  });
  const hasSeparateCash = effectiveCashBRL > 0 && !hasCashGroup;

  // SSOT: Totalizador consolidado derivado estritamente da soma das linhas renderizadas
  const appliedAssetsCostCents = classGroups.reduce((acc, g) => acc + (g.totalCostCents ?? 0), 0);
  const sumRenderedCostCents =
    appliedAssetsCostCents + (hasSeparateCash ? numberToCents(effectiveCashBRL) : 0);
  const sumRenderedTotalCents =
    classGroups.reduce((acc, g) => acc + (g.totalCents ?? 0), 0) +
    (hasSeparateCash ? numberToCents(effectiveCashBRL) : 0);

  const totalConsolidatedCostBRL =
    sumRenderedCostCents > 0
      ? sumRenderedCostCents / 100
      : hasSeparateCash
        ? effectiveCostBRL + effectiveCashBRL
        : effectiveCostBRL;
  const totalConsolidatedTotalBRL =
    sumRenderedTotalCents > 0 ? sumRenderedTotalCents / 100 : effectiveTotalBRL;

  const totalPnlBRL = totalConsolidatedTotalBRL - totalConsolidatedCostBRL;
  const consolidatedPnlPct =
    totalConsolidatedCostBRL > 0 ? (totalPnlBRL / totalConsolidatedCostBRL) * 100 : 0;

  const hasPage2 = classGroups.length > 0;

  return (
    <div className="flex flex-col gap-4 w-full print:block print:space-y-3">
      <ReportHeader
        title="Relatório Executivo de Acompanhamento da Carteira"
        subtitle="Posição Patrimonial Consolidada & Custódia de Ativos"
        periodLabel={periodLabel}
        appName={appName}
        icon={TrendingUp}
        accountHolder={accountHolder}
      />

      {showDiscrepancyAlert && fidelity && discrepancyPct != null ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-warning/30 bg-warning/5 text-xs text-foreground print:hidden">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-warning/20 bg-warning/15 text-warning-strong">
              <AlertCircle className="size-4.5" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-semibold text-warning-strong">
                Conciliação Sugerida ({formatSignedPct(discrepancyPct)})
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                O saldo oficial do fechamento (
                <MoneyText
                  cents={numberToCents(fidelity.snapshotTotalValue ?? effectiveTotalBRL)}
                  variant="caption"
                  tone="default"
                  className="inline font-medium text-foreground"
                />
                ) difere da soma analítica de ativos (
                <MoneyText
                  cents={numberToCents(fidelity.reconstructedTotalValue)}
                  variant="caption"
                  tone="default"
                  className="inline font-medium text-foreground"
                />
                ).
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenClosing}
            className="shrink-0 gap-1.5 font-medium self-stretch sm:self-auto"
          >
            <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Abrir Editor de Fechamento</span>
          </Button>
        </div>
      ) : null}

      <ReportExecutiveSummary
        title="SÍNTESE PATRIMONIAL & DESEMPENHO"
        items={[
          {
            label: "Patrimônio Total",
            value: <MoneyText cents={numberToCents(effectiveTotalBRL)} tone="portfolio" />,
            subtext: `${investmentCount} ${investmentCount === 1 ? "ativo" : "ativos"} em custódia`,
          },
          {
            label: "TWR do Mês",
            value:
              monthRatePct !== null && monthRatePct !== undefined ? (
                <span className={monthRatePct >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                  {formatSignedPct(monthRatePct)}
                </span>
              ) : (
                "0,0%"
              ),
            subtext: "Padrão CVM (isolado)",
          },
          {
            label: "Resultado (P&L)",
            value: (
              <MoneyText
                cents={numberToCents(monthNetPnlBRL)}
                tone={isPositivePnl ? "positive" : "negative"}
                sign="explicit"
              />
            ),
            subtext: "Líquido da competência",
          },
          {
            label: "Proventos do Mês",
            value: (
              <MoneyText
                cents={numberToCents(monthDividendsBRL)}
                tone={monthDividendsBRL > 0 ? "positive" : "portfolio"}
              />
            ),
            subtext: "Recebidos no período",
          },
        ]}
        narrative={
          <span>
            A carteira encerra a competência com{" "}
            <strong>
              <MoneyText cents={numberToCents(effectiveTotalBRL)} className="inline font-bold" />
            </strong>{" "}
            sob custódia{" "}
            {hasSeparateCash && appliedAssetsCostCents > 0 ? (
              <>
                (custo de aquisição de{" "}
                <MoneyText
                  cents={appliedAssetsCostCents}
                  className="inline font-bold text-muted-foreground"
                />{" "}
                em ativos aplicados, totalizando{" "}
                <MoneyText
                  cents={numberToCents(totalConsolidatedCostBRL)}
                  className="inline font-bold text-muted-foreground"
                />{" "}
                com a reserva de caixa),
              </>
            ) : appliedAssetsCostCents > 0 ? (
              <>
                (custo de aquisição de{" "}
                <MoneyText
                  cents={numberToCents(effectiveCostBRL)}
                  className="inline font-bold text-muted-foreground"
                />
                ),
              </>
            ) : null}{" "}
            distribuídos em{" "}
            {investmentCount > 0 ? (
              <>
                <strong>
                  {investmentCount} {investmentCount === 1 ? "ativo" : "ativos"}
                  {effectiveCashBRL > 0 ? " + Reserva de Caixa" : ""}
                </strong>{" "}
                e <strong>{classGroups.length} {classGroups.length === 1 ? "classe patrimonial" : "classes patrimoniais"}</strong>.
              </>
            ) : (
              <strong>Reserva de Caixa (Disponibilidades).</strong>
            )}
          </span>
        }
      />

      <ReportMonthlyMovements
        variant="strip"
        monthBuysBRL={stmt?.monthBuysBRL ?? 0}
        monthSellsBRL={stmt?.monthSellsBRL ?? 0}
        monthDividendsBRL={monthDividendsBRL}
        monthNetContributionBRL={stmt?.monthNetContributionBRL ?? 0}
        transactionsCount={stmt?.transactionsCount}
        dividendsCount={stmt?.dividendsCount}
        pqs={pqs}
      />

      {/* Quadro-Síntese de Alocação por Classe de Ativos (Página 1) */}
      {classGroups.length > 0 ? (
        <section
          aria-label="Síntese da Alocação Patrimonial"
          className="rounded-xl border border-border/80 bg-surface shadow-xs p-3.5 print:p-3 break-inside-avoid"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Síntese da Alocação por Classe de Ativos
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {classGroups.length} {classGroups.length === 1 ? "classe" : "classes"}{hasSeparateCash ? " + Caixa" : " sob custódia"}
            </span>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left bg-muted/40">
                  <th className="py-1 px-2 font-bold">Classe de Ativo</th>
                  <th className="py-1 px-2 font-bold text-center">Ativos</th>
                  <th className="py-1 px-2 text-right font-bold">Posição Atual (R$)</th>
                  <th className="py-1 px-2 text-right font-bold">% Portfólio</th>
                  <th className="py-1 px-2 text-right font-bold">Custo Aquisição (R$)</th>
                  <th className="py-1 px-2 text-right font-bold">Retorno P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {classGroups.map((g) => {
                  const className = g.className;
                  const totalCents = g.totalCents ?? 0;
                  const costCents = g.totalCostCents ?? 0;
                  const pct = effectiveTotalBRL > 0 ? (totalCents / numberToCents(effectiveTotalBRL)) * 100 : 0;
                  const returnPct = costCents > 0 ? ((totalCents - costCents) / costCents) * 100 : 0;
                  return (
                    <tr key={className} className="even:bg-muted/20">
                      <td className="py-1.5 px-2 font-semibold text-foreground whitespace-nowrap">{className}</td>
                      <td className="py-1.5 px-2 text-center text-muted-foreground font-mono">{g.items?.length ?? 0}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold">
                        <MoneyText cents={totalCents} hideCurrency />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                        {formatPercent(pct)}%
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                        <MoneyText cents={costCents} hideCurrency />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold">
                        <span className={returnPct >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                          {formatSignedPct(returnPct)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {hasSeparateCash && (
                  <tr key="reserva-caixa-sintese" className="even:bg-muted/20">
                    <td className="py-1.5 px-2 font-semibold text-foreground whitespace-nowrap">Reserva de Caixa</td>
                    <td className="py-1.5 px-2 text-center text-muted-foreground font-mono">—</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      <MoneyText cents={numberToCents(effectiveCashBRL)} hideCurrency />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                      {formatPercent(effectiveTotalBRL > 0 ? (effectiveCashBRL / effectiveTotalBRL) * 100 : 0)}%
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                      <MoneyText cents={numberToCents(effectiveCashBRL)} hideCurrency />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border/80 font-bold bg-muted/30">
                  <td className="py-1.5 px-2 uppercase tracking-wider text-[10px]">Total Consolidado</td>
                  <td className="py-1.5 px-2 text-center font-mono">
                    {investmentCount}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    <MoneyText cents={numberToCents(totalConsolidatedTotalBRL)} hideCurrency />
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-foreground">100,0%</td>
                  <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                    <MoneyText cents={numberToCents(totalConsolidatedCostBRL)} hideCurrency />
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold">
                    {totalConsolidatedCostBRL > 0 ? (
                      <span className={totalPnlBRL >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                        {formatSignedPct(consolidatedPnlPct)}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      {hasPage2 ? (
        <ReportFooter
          accountHolder={accountHolder}
          reportType="carteira"
          currentPage={1}
          totalPages={2}
          variant="running"
          className="hidden print:flex"
        />
      ) : (
        <ReportFooter
          accountHolder={accountHolder}
          disclaimer={OFFICIAL_CVM_DISCLAIMER}
          reportType="carteira"
          currentPage={1}
          totalPages={1}
          variant="full"
          showQrCode
        />
      )}

      {hasPage2 && (
        <section
          aria-label="Detalhamento das Posições"
          className="flex flex-col justify-between gap-3 pt-1 min-h-[960px] print:min-h-0 print:block print:space-y-3 print-break-before-page print:break-before-page"
        >
          <div className="flex flex-col gap-3">
            <ReportRunningHeader
              title="Relatório Executivo da Carteira"
              periodLabel={periodLabel}
            />
            <ReportClassTables groups={classGroups} />
            {hasSeparateCash && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/80 bg-muted/20 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full shrink-0 bg-[hsl(var(--cat-7))]"
                    aria-hidden="true"
                  />
                  <span className="font-bold text-foreground">
                    Reserva de Caixa
                  </span>
                  <span className="text-muted-foreground text-[11px] hidden sm:inline print:inline">
                    · Disponibilidades &amp; Liquidez Imediata
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono num">
                  <span className="font-bold text-foreground">
                    <MoneyText cents={numberToCents(effectiveCashBRL)} />
                  </span>
                  <span className="text-muted-foreground font-semibold text-[11px]">
                    ({formatPercent(effectiveTotalBRL > 0 ? (effectiveCashBRL / effectiveTotalBRL) * 100 : 0)}%)
                  </span>
                </div>
              </div>
            )}
          </div>

          <ReportFooter
            accountHolder={accountHolder}
            disclaimer={OFFICIAL_CVM_DISCLAIMER}
            reportType="carteira"
            currentPage={2}
            totalPages={2}
            variant="full"
            showQrCode
          />
        </section>
      )}
    </div>
  );
}
