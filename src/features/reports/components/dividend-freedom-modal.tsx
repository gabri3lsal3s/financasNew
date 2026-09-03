import { Flame, PiggyBank, Sparkles } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportExecutiveSummary,
  ReportDividendSparkline,
  ReportFooter,
} from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { sanitizeReportText, type FreedomAnalysisResult } from "@/domain/reports";
import { formatPercent } from "@/services/masks";
import type { PortfolioDividend } from "@/types";

export interface DividendFreedomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freedomAnalysis: FreedomAnalysisResult;
  dividends: readonly PortfolioDividend[];
  yearDividendsBRL: number;
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
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
  periodLabel = "Exercício Anual",
  appName = "Guia Financeiro",
  accountHolder,
}: DividendFreedomModalProps) {
  const currentYear = new Date().getFullYear();

  // Matriz de 12 meses de proventos do ano corrente para o Sparkline SVG
  const sparklinePoints = Array.from({ length: 12 }, (_, idx) => {
    const monthStr = `${currentYear}-${String(idx + 1).padStart(2, "0")}`;
    const sumBRL = dividends
      .filter((d) => d.date.startsWith(monthStr))
      .reduce((acc, d) => acc + d.amount, 0);

    return {
      month: monthStr,
      label: MONTH_NAMES[idx] ?? `M${idx + 1}`,
      amountCents: numberToCents(sumBRL),
    };
  });

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê de Proventos & Liberdade Financeira"
    >
      {/* 1. Cabeçalho Institucional */}
      <ReportHeader
        title="Dossiê de Proventos & Liberdade Financeira"
        subtitle="Fluxo de Renda Passiva, Efeito Bola de Neve & Cobertura do Custo de Vida"
        periodLabel={periodLabel}
        appName={appName}
        icon={PiggyBank}
        accountHolder={accountHolder}
      />

      {/* 2. Síntese Executiva & KPIs em Linha Única */}
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
            value: `${formatPercent(freedomAnalysis.freedomPct)}%`,
            subtext: "Custo de Vida Pago",
          },
          {
            label: "Autonomia Patrimonial",
            value: `${freedomAnalysis.runwayMonths.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses`,
            subtext: "Runway de Reserva",
          },
        ]}
        narrative={
          <span>
            No exercício corrente (<strong>{currentYear}</strong>), o fluxo acumulado de proventos totalizou <strong><MoneyText cents={numberToCents(yearDividendsBRL)} tone="positive" className="inline font-bold" /></strong>, perfazendo uma média mensal de <strong><MoneyText cents={numberToCents(freedomAnalysis.monthlyDividendsBRL)} tone="positive" className="inline font-bold" /></strong>. Este fluxo cobre <strong>{formatPercent(freedomAnalysis.freedomPct)}%</strong> do custo de vida mensal (Estágio: <strong>{freedomAnalysis.stageLabel}</strong>). A carteira possui <strong>{freedomAnalysis.totalSnowballAssetsCount} ativo(s) auto-sustentável(is)</strong> operando no Efeito Bola de Neve.
          </span>
        }
      />

      {/* 3. Termômetro do Estágio de Liberdade Financeira */}
      <section
        aria-label="Termômetro de Liberdade"
        className="rounded-lg border border-border/80 bg-muted/30 p-3 flex flex-col gap-2 break-inside-avoid print:bg-white print:border-slate-200 shadow-2xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
              Estágio de Independência Financeira (FIRE)
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary-strong">
            {freedomAnalysis.stageLabel}
          </span>
        </div>

        <div className="w-full bg-muted/40 rounded-full h-2 overflow-hidden border border-border/80">
          <div
            className="bg-primary-strong h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(3, freedomAnalysis.freedomPct))}%` }}
          />
        </div>

        <div className="flex justify-between text-[9px] text-muted-foreground font-mono num">
          <span>0% (Início)</span>
          <span>25% (1º Quarto)</span>
          <span>50% (Metade)</span>
          <span>75% (Segurança)</span>
          <span>100% (Independência Plena)</span>
        </div>
      </section>

      {/* 4. Gráfico de Colunas de 12 Meses de Proventos */}
      <ReportDividendSparkline
        title={`Fluxo Mensal de Rendimentos (${currentYear})`}
        points={sparklinePoints}
        averageMonthlyCents={numberToCents(freedomAnalysis.monthlyDividendsBRL)}
        projectedAnnualCents={numberToCents(freedomAnalysis.monthlyDividendsBRL * 12)}
      />


      {/* 5. Diagnóstico do Efeito Bola de Neve */}
      <section aria-label="Efeito Bola de Neve" className="break-inside-avoid flex flex-col gap-2.5 pt-1">
        <div className="flex items-center justify-between border-b border-border/80 pb-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-primary-strong" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Ativos no Efeito Bola de Neve (Reinvestimento Próprio)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono num">
            {freedomAnalysis.totalSnowballAssetsCount} ativo(s) auto-sustentável(is)
          </span>
        </div>

        {freedomAnalysis.snowballAssets.length > 0 ? (
          <div className="rounded-xl border border-border/80 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse print:table-fixed">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-3 print:w-[18%]">Ticker</th>
                  <th className="py-2 px-3 text-right print:w-[18%]">Preço Atual</th>
                  <th className="py-2 px-3 text-right print:w-[22%]">Renda Mensal Gerada</th>
                  <th className="py-2 px-3 text-right print:w-[20%]">Cotas Compradas / Mês</th>
                  <th className="py-2 px-3 text-center print:w-[22%]">Status da Bola de Neve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {freedomAnalysis.snowballAssets.map((sb) => (
                  <tr key={sb.ticker} className="hover:bg-muted/20 break-inside-avoid even:bg-muted/20 print:even:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-semibold text-foreground truncate">{sanitizeReportText(sb.ticker)}</td>
                    <td className="py-1.5 px-3 text-right num font-mono">
                      <MoneyText cents={numberToCents(sb.currentPriceBRL)} />
                    </td>
                    <td className="py-1.5 px-3 text-right num font-mono text-positive-strong font-bold">
                      <MoneyText cents={numberToCents(sb.monthlyIncomeGeneratedBRL)} />
                    </td>
                    <td className="py-1.5 px-3 text-right num font-mono font-bold text-foreground">
                      {sb.newSharesPerMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sb.newSharesPerMonth === 1 ? "cota" : "cotas"}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-bold ${
                          sb.isSnowballReached
                            ? "bg-positive/10 text-positive-strong border border-positive/20"
                            : "bg-muted/40 text-muted-foreground border border-border"
                        }`}
                      >
                        {sb.isSnowballReached
                          ? "Bola de Neve Ativa"
                          : `${Math.ceil(sb.monthsToBuyOneShare)} mês(es) p/ 1 cota`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-border/80 bg-muted/10 p-3 text-xs text-muted-foreground italic print:bg-white print:border-border">
            Nenhum ativo com proventos mensais cadastrados no momento.
          </div>
        )}
      </section>

      {/* 6. Rodapé Institucional */}
      <ReportFooter
        accountHolder={accountHolder}
        disclaimer="Documento estritamente informativo gerado automaticamente com base nos dados e metas parametrizados pelo titular. Não constitui análise, consultoria, recomendação de compra, venda ou alocação de valores mobiliários (Resoluções CVM nº 19 e 20/2021). Rentabilidade passada não representa garantia de retorno futuro."
      />
    </ReportDocumentLayout>
  );
}

