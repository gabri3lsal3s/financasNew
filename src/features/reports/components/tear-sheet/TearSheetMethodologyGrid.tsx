import { Activity, Briefcase, CircleDollarSign, Scale, TrendingUp } from "lucide-react";
import { EquationBreakdownPopover } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { TwrConsolidatedResult, XIRRResult } from "@/domain/portfolio";
import { formatSignedPct } from "@/services/masks/percent";

export interface TearSheetMethodologyGridProps {
  portfolioTwr?: TwrConsolidatedResult;
  portfolioIrr?: XIRRResult;
  totalReturnPct: number;
  historicalPnlBRL: number;
}

export function TearSheetMethodologyGrid({
  portfolioTwr,
  portfolioIrr,
  totalReturnPct,
  historicalPnlBRL,
}: TearSheetMethodologyGridProps) {
  return (
    <section
      aria-label="Metodologias de Rentabilidade"
      className="flex flex-col gap-3 pt-2 print:pt-1 break-inside-avoid print:break-inside-avoid w-full"
    >
      <div className="report-section-header flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Scale className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
            Metodologias &amp; Métricas de Rentabilidade da Carteira
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          Transparência Metodológica (Padrão ANBIMA / CVM)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs w-full">
        <div className="rounded-xl border border-border/80 bg-surface p-3 print:border-border shadow-xs w-full flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
            <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 min-w-0">
              <TrendingUp className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate">1. TWR (Cotas — Padrão CVM / ANBIMA)</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge
                variant={
                  portfolioTwr?.status === "ok" && portfolioTwr.accumulatedRatePct !== null
                    ? portfolioTwr.accumulatedRatePct >= 0
                      ? "positive"
                      : "negative"
                    : "muted"
                }
                size="xs"
                className="font-mono font-bold tracking-tight shrink-0"
              >
                {portfolioTwr?.status === "ok" && portfolioTwr.accumulatedRatePct !== null
                  ? formatSignedPct(portfolioTwr.accumulatedRatePct)
                  : "Em formação"}
              </Badge>
              {portfolioTwr?.status === "ok" && (
                <EquationBreakdownPopover
                  title="Rentabilidade Ponderada pelo Tempo (TWR)"
                  description="Métrica oficial de fundos de investimento (ANBIMA/CVM) que apura a performance dos ativos isolando o efeito de aportes e resgates via sistema de cotas."
                  formula="R_acum = ∏(1 + r_t) − 1 | R_anual = (1 + R_acum)^(12/N) − 1"
                  items={[
                    {
                      label: "Valor Atual da Cota",
                      cents: numberToCents(portfolioTwr.currentSharePrice),
                      sign: "=",
                      tone: "portfolio",
                      hint: `Base inicial 100,00 (${portfolioTwr.monthsElapsed} ${portfolioTwr.monthsElapsed === 1 ? "mês" : "meses"} de histórico)`,
                    },
                    ...(portfolioTwr.annualizedRatePct !== null
                      ? [
                          {
                            label: "Taxa Anualizada CVM",
                            cents: numberToCents(portfolioTwr.annualizedRatePct),
                            sign: "+" as const,
                            tone: portfolioTwr.annualizedRatePct >= 0 ? ("positive" as const) : ("negative" as const),
                            hint: `${formatSignedPct(portfolioTwr.annualizedRatePct)} a.a. (composto anual)`,
                          },
                        ]
                      : []),
                  ]}
                  totalLabel="Rentabilidade Acumulada"
                  totalCents={numberToCents(portfolioTwr.accumulatedRatePct)}
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
              Métrica Oficial da Carteira
            </span>
            <p className="text-[11px] leading-relaxed text-muted-foreground m-0">
              Apura a performance real das suas decisões de investimento pelo método de cotas. Isola aportes e resgates para que movimentações de capital não distorçam a rentabilidade percentual acumulada.
            </p>
          </div>
          <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
            <Badge variant="muted" size="xs" className="font-medium text-muted-foreground">
              Indicado para: Comparação com CDI e Ibovespa
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 print:border-border shadow-xs w-full flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
            <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 min-w-0">
              <Activity className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate">2. Retorno do Bolso (TIR / XIRR)</span>
            </span>
            <Badge
              variant={
                portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null
                  ? portfolioIrr.annualizedRatePct >= 0
                    ? "positive"
                    : "negative"
                  : "muted"
              }
              size="xs"
              className="font-mono font-bold tracking-tight shrink-0"
            >
              {portfolioIrr?.isEligible && portfolioIrr.annualizedRatePct !== null
                ? `${formatSignedPct(portfolioIrr.annualizedRatePct)} a.a.`
                : "Em formação"}
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
              Retorno do Seu Fluxo Pessoal
            </span>
            <p className="text-[11px] leading-relaxed text-muted-foreground m-0">
              Taxa anualizada (% a.a.) ponderada pelo dinheiro real que saiu do seu bolso para a corretora frente ao patrimônio atual. Pondera volume por tempo: períodos com maior capital investido exercem maior peso na taxa.
            </p>
          </div>
          <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
            <Badge variant="muted" size="xs" className="font-medium text-muted-foreground">
              Indicado para: Eficiência do timing de aportes
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 print:border-border shadow-xs w-full flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
            <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 min-w-0">
              <Briefcase className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate">3. Retorno Contábil da Custódia Aberta</span>
            </span>
            <Badge
              variant={totalReturnPct >= 0 ? "positive" : "negative"}
              size="xs"
              className="font-mono font-bold tracking-tight shrink-0"
            >
              {formatSignedPct(totalReturnPct)}
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
              Ganho Estático das Posições Ativas
            </span>
            <p className="text-[11px] leading-relaxed text-muted-foreground m-0">
              Mede estritamente a valorização das ações, FIIs e títulos em custódia hoje frente ao Preço Médio pago, somando os proventos recebidos dessas posições ativas. Não considera ativos já vendidos/vencidos nem o tempo decorrido.
            </p>
          </div>
          <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
            <Badge variant="muted" size="xs" className="font-medium text-muted-foreground">
              Indicado para: Posições em custódia ativa
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 print:border-border shadow-xs w-full flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
            <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 min-w-0">
              <CircleDollarSign className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate">4. Resultado Histórico (P&amp;L Total em R$)</span>
            </span>
            <Badge
              variant={historicalPnlBRL >= 0 ? "positive" : "negative"}
              size="xs"
              className="font-mono font-bold tracking-tight shrink-0"
            >
              <MoneyText
                cents={numberToCents(historicalPnlBRL)}
                tone={historicalPnlBRL >= 0 ? "positive" : "negative"}
                sign="explicit"
              />
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
              Riqueza Efetiva Produzida
            </span>
            <p className="text-[11px] leading-relaxed text-muted-foreground m-0">
              Consolida em reais todo o ganho líquido acumulado pela carteira desde o primeiro investimento. Soma os lucros brutos realizados em operações encerradas no passado, o ganho de capital aberto de hoje e a totalidade dos proventos já recebidos.
            </p>
          </div>
          <div className="pt-1.5 border-t border-border/40 flex items-center justify-between">
            <Badge variant="muted" size="xs" className="font-medium text-muted-foreground">
              Indicado para: Dimensão financeira total e caixa
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
