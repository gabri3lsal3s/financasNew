import { useMemo } from "react";
import { Flame, PiggyBank, Sparkles } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportExecutiveSummary,
  ReportDividendSparkline,
  ReportFooter,
} from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  type FireSections,
  type FreedomAnalysisResult,
  type ReportReadinessResult,
  sanitizeReportText,
} from "@/domain/reports";
import { formatPercent } from "@/services/masks";
import { OFFICIAL_CVM_DISCLAIMER } from "@/lib/institutional";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

export interface DividendFreedomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freedomAnalysis: FreedomAnalysisResult;
  dividends: readonly PortfolioDividend[];
  yearDividendsBRL: number;
  assets?: readonly PortfolioAsset[];
  usdRate?: number;
  periodLabel?: string;
  referenceYear?: number;
  appName?: string;
  accountHolder?: string;
  readiness?: ReportReadinessResult<FireSections>;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * Dossiê de Proventos, Renda Passiva & Liberdade Financeira (F42/F44).
 * Apresenta o fluxo anual de dividendos, estágio FIRE e efeito bola de neve em padrão A4.
 */
export function DividendFreedomModal({
  open,
  onOpenChange,
  freedomAnalysis,
  dividends,
  yearDividendsBRL,
  assets,
  usdRate = 5.25,
  periodLabel = "Exercício Anual",
  referenceYear,
  appName = "Axir",
  accountHolder,
}: DividendFreedomModalProps) {
  const currentYear = useMemo(() => {
    if (referenceYear) return referenceYear;
    for (const d of dividends) {
      const yr = parseInt(d.date?.slice(0, 4), 10);
      if (yr >= 2020 && yr <= 2050) return yr;
    }
    return new Date().getFullYear();
  }, [dividends, referenceYear]);
  const assetMap = useMemo(() => new Map((assets ?? []).map((a) => [a.id, a])), [assets]);

  const sparklinePoints = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => {
      const monthStr = `${currentYear}-${String(idx + 1).padStart(2, "0")}`;
      const sumBRL = dividends
        .filter((d) => d.date.startsWith(monthStr))
        .reduce((acc, d) => {
          const asset = d.asset_id ? assetMap.get(d.asset_id) : undefined;
          const rate = asset?.currency === "USD" ? usdRate : 1;
          return acc + d.amount * rate;
        }, 0);

      return {
        month: monthStr,
        label: MONTH_NAMES[idx] ?? `M${idx + 1}`,
        amountCents: numberToCents(sumBRL),
      };
    });
  }, [currentYear, dividends, assetMap, usdRate]);

  const progressPct = Math.min(100, Math.max(0, freedomAnalysis.freedomPct));

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê de Proventos & Liberdade Financeira"
      documentTitle={`AXIR_Dossie_FIRE_${currentYear}.pdf`}
    >
      <ReportHeader
        title="Dossiê de Proventos & Liberdade Financeira"
        subtitle="Fluxo de Renda Passiva, Efeito Bola de Neve & Cobertura do Custo de Vida"
        periodLabel={periodLabel}
        appName={appName}
        icon={PiggyBank}
        accountHolder={accountHolder}
      />

      <ReportExecutiveSummary
        title="SÍNTESE DE PROVENTOS & INDEPENDÊNCIA FINANCEIRA"
        items={[
          {
            label: "Proventos no Ano",
            value: <MoneyText cents={numberToCents(yearDividendsBRL)} tone="positive" />,
            subtext: `Total em ${currentYear}`,
          },
          {
            label: "Média Mensal",
            value: <MoneyText cents={numberToCents(freedomAnalysis.monthlyDividendsBRL)} tone="positive" />,
            subtext: "Renda Passiva Mensal",
          },
          {
            label: "Cobertura de Gastos",
            value:
              freedomAnalysis.monthlyExpensesBRL > 0
                ? `${formatPercent(freedomAnalysis.freedomPct)}%`
                : "—",
            subtext:
              freedomAnalysis.monthlyExpensesBRL > 0
                ? "Custo de Vida Pago"
                : "Não parametrizado",
          },
          {
            label: "Autonomia Patrimonial",
            value:
              freedomAnalysis.monthlyExpensesBRL > 0
                ? `${freedomAnalysis.runwayMonths.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses`
                : "—",
            subtext:
              freedomAnalysis.monthlyExpensesBRL > 0
                ? "Runway de Reserva"
                : "Sem gastos base",
          },
        ]}
        narrative={
          <span>
            No exercício corrente (<strong>{currentYear}</strong>), o fluxo acumulado de proventos totalizou{" "}
            <strong>
              <MoneyText cents={numberToCents(yearDividendsBRL)} tone="positive" className="inline font-bold" />
            </strong>, perfazendo uma média mensal de{" "}
            <strong>
              <MoneyText cents={numberToCents(freedomAnalysis.monthlyDividendsBRL)} tone="positive" className="inline font-bold" />
            </strong>.{" "}
            {freedomAnalysis.monthlyExpensesBRL > 0 ? (
              <>
                Este fluxo cobre <strong>{formatPercent(freedomAnalysis.freedomPct)}%</strong> do custo de vida mensal (Estágio: <strong>{freedomAnalysis.stageLabel}</strong>).
              </>
            ) : (
              <>Custo de vida mensal não parametrizado nas configurações financeiras.</>
            )}{" "}
            A carteira possui{" "}
            <strong>
              {freedomAnalysis.totalSnowballAssetsCount}{" "}
              {freedomAnalysis.totalSnowballAssetsCount === 1 ? "ativo autossustentável" : "ativos autossustentáveis"}
            </strong>{" "}
            operando no Efeito Bola de Neve.
          </span>
        }
      />

      {/* Régua Milimétrica Minimalista de Alta Precisão (FIRE) */}
      <section
        aria-label="Termômetro de Liberdade"
        className="rounded-xl border border-border/80 bg-muted/15 p-3 flex flex-col gap-2.5 break-inside-avoid print:bg-surface print:border-border shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Flame className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
              Estágio de Independência Financeira (FIRE)
            </h3>
          </div>
          <Badge size="xs" variant="default" className="font-mono">
            {freedomAnalysis.stageLabel} · {formatPercent(freedomAnalysis.freedomPct)}%
          </Badge>
        </div>

        {/* Trilha e cursor de precisão */}
        <div className="relative pt-1 pb-1">
          <div className="w-full bg-muted/50 rounded-sm h-2 overflow-hidden border border-border/80">
            <div
              className="bg-primary-strong h-full rounded-sm transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 5 Marcos Equidistantes */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-1 text-[10px] text-muted-foreground font-mono num border-t border-border/50 pt-1.5">
          <div className="text-left">
            <span className="block font-bold text-foreground">0%</span>
            <span>Início</span>
          </div>
          <div className="text-center">
            <span className="block font-bold text-foreground">25%</span>
            <span>1º Quarto</span>
          </div>
          <div className="text-center">
            <span className="block font-bold text-foreground">50%</span>
            <span>Metade</span>
          </div>
          <div className="text-center">
            <span className="block font-bold text-foreground">75%</span>
            <span>Segurança</span>
          </div>
          <div className="text-right">
            <span className="block font-bold text-foreground">100%</span>
            <span>Independência</span>
          </div>
        </div>
      </section>

      <ReportDividendSparkline
        title={`Fluxo Mensal de Rendimentos (${currentYear})`}
        points={sparklinePoints}
        averageMonthlyCents={numberToCents(freedomAnalysis.monthlyDividendsBRL)}
        projectedAnnualCents={numberToCents(freedomAnalysis.monthlyDividendsBRL * 12)}
      />

      <section aria-label="Efeito Bola de Neve" className="break-inside-avoid flex flex-col gap-2.5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Ativos no Efeito Bola de Neve (Reinvestimento Próprio)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono num">
            {freedomAnalysis.totalSnowballAssetsCount}{" "}
            {freedomAnalysis.totalSnowballAssetsCount === 1 ? "ativo autossustentável" : "ativos autossustentáveis"}
          </span>
        </div>

        {freedomAnalysis.snowballAssets.length > 0 ? (
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 print:overflow-visible">
            <table className="w-full min-w-[540px] sm:min-w-0 text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-3">Ticker</th>
                  <th className="py-2 px-3 text-right">Preço (R$)</th>
                  <th className="py-2 px-3 text-right">Renda Mensal (R$)</th>
                  <th className="py-2 px-3 text-right">Cotas / Mês</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {freedomAnalysis.snowballAssets.map((sb) => {
                  const monthsToCota = Math.ceil(sb.monthsToBuyOneShare);
                  return (
                    <tr key={sb.ticker} className="hover:bg-muted/20 break-inside-avoid even:bg-muted/20 print:even:bg-muted/20">
                      <td className="py-1.5 px-3 font-semibold text-foreground whitespace-nowrap">
                        {sanitizeReportText(sb.ticker)}
                      </td>
                      <td className="py-1.5 px-3 text-right num font-mono whitespace-nowrap">
                        <MoneyText cents={numberToCents(sb.currentPriceBRL)} hideCurrency />
                      </td>
                      <td className="py-1.5 px-3 text-right num font-mono text-positive-strong font-bold whitespace-nowrap">
                        <MoneyText cents={numberToCents(sb.monthlyIncomeGeneratedBRL)} hideCurrency />
                      </td>
                      <td className="py-1.5 px-3 text-right num font-mono font-bold text-foreground whitespace-nowrap">
                        {sb.newSharesPerMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                        {sb.newSharesPerMonth === 1 ? "cota" : "cotas"}
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <Badge variant={sb.isSnowballReached ? "positive" : "muted"} size="xs">
                          {sb.isSnowballReached
                            ? "Bola de Neve Ativa"
                            : monthsToCota === 1
                              ? "1 mês p/ 1 cota"
                              : `${monthsToCota} meses p/ 1 cota`}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border/70 p-2.5 text-[11px] text-muted-foreground italic print:bg-surface print:border-border">
            Nenhum ativo com proventos suficientes para reinvestimento autônomo (efeito bola de neve) registrado no exercício.
          </div>
        )}
      </section>

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_CVM_DISCLAIMER}
        reportType="fire"
        currentPage={1}
        totalPages={1}
        showQrCode
      />
    </ReportDocumentLayout>
  );
}
