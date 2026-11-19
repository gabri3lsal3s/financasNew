import { AlertCircle, SlidersHorizontal, TrendingUp } from "lucide-react";
import { Button, MoneyText } from "@/components/ui";
import {
  ReportClassTables,
  ReportExecutiveSummary,
  ReportFooter,
  ReportHeader,
  ReportMonthlyMovements,
} from "@/components/modules/reports";
import type { ReportClassGroup } from "@/components/modules/reports/report-class-tables";
import { numberToCents } from "@/domain/money";
import type { PointInTimeFidelity, PointInTimeResult } from "@/domain/portfolio/point-in-time";
import { OFFICIAL_CVM_DISCLAIMER } from "@/lib/institutional";
import { formatSignedPct } from "@/services/masks";

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

  return (
    <div className="flex flex-col gap-4 w-full print:block print:space-y-4">
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
            label: "Patrimônio no Fechamento",
            value: <MoneyText cents={numberToCents(effectiveTotalBRL)} tone="portfolio" />,
            subtext: `${investmentCount} ${investmentCount === 1 ? "ativo" : "ativos"} em custódia`,
          },
          {
            label: "Rentabilidade da Competência (TWR)",
            value:
              monthRatePct !== null && monthRatePct !== undefined ? (
                <span className={monthRatePct >= 0 ? "text-positive-strong" : "text-negative-strong"}>
                  {formatSignedPct(monthRatePct)}
                </span>
              ) : (
                "0,0%"
              ),
            subtext: "Variação isolada do mês (Padrão CVM)",
          },
          {
            label: "Resultado Líquido do Mês (P&L)",
            value: (
              <MoneyText
                cents={numberToCents(monthNetPnlBRL)}
                tone={isPositivePnl ? "positive" : "negative"}
                sign="explicit"
              />
            ),
            subtext: "P&L líquido da competência",
          },
          {
            label: "Proventos da Competência",
            value: (
              <MoneyText
                cents={numberToCents(monthDividendsBRL)}
                tone={monthDividendsBRL > 0 ? "positive" : "portfolio"}
              />
            ),
            subtext: "Recebidos no mês",
          },
        ]}
        narrative={
          <span>
            A carteira encerra a competência com{" "}
            <strong>
              <MoneyText cents={numberToCents(effectiveTotalBRL)} className="inline font-bold" />
            </strong>{" "}
            sob custódia (custo de aquisição de{" "}
            <MoneyText
              cents={numberToCents(effectiveCostBRL)}
              className="inline font-bold text-muted-foreground"
            />
            ), distribuídos em{" "}
            <strong>{investmentCount} ativos{effectiveCashBRL > 0 ? " + Reserva de Caixa" : ""}</strong> e{" "}
            <strong>{classGroups.length} classes patrimoniais</strong>.
            {pqs !== null && pqs !== undefined ? (
              <>
                {" "}
                O Índice de Qualidade da Carteira (PQS ponderado) situa-se em{" "}
                <strong className="text-foreground">{pqs.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 10</strong>.
              </>
            ) : null}{" "}
            O saldo em reserva de liquidez é de{" "}
            <MoneyText cents={numberToCents(effectiveCashBRL)} className="inline font-bold" />{" "}
            e os proventos creditados na competência somam{" "}
            <MoneyText
              cents={numberToCents(monthDividendsBRL)}
              className="inline font-bold text-positive-strong"
            />
            .
          </span>
        }
      />

      <ReportMonthlyMovements
        monthBuysBRL={stmt?.monthBuysBRL ?? 0}
        monthSellsBRL={stmt?.monthSellsBRL ?? 0}
        monthDividendsBRL={monthDividendsBRL}
        monthNetContributionBRL={stmt?.monthNetContributionBRL ?? 0}
        transactionsCount={stmt?.transactionsCount}
        dividendsCount={stmt?.dividendsCount}
      />

      <section aria-label="Detalhamento das Posições" className="flex flex-col gap-3 pt-1 print:block print:space-y-3">
        <ReportClassTables groups={classGroups} />
      </section>

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_CVM_DISCLAIMER}
        showQrCode
      />
    </div>
  );
}
