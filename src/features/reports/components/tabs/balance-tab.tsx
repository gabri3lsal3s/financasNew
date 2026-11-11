import { Flame, Printer, Scale } from "lucide-react";
import { Button } from "@/components/ui";
import { EquationBreakdownPopover } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { formatPercent } from "@/services/masks";
import type { ConsolidatedBalanceSheetResult, FreedomAnalysisResult } from "@/domain/reports";

export interface BalanceTabProps {
  consolidatedBalance: ConsolidatedBalanceSheetResult;
  freedomAnalysis: FreedomAnalysisResult;
  onOpenConsolidatedWealth: () => void;
  onOpenDividendFreedom: () => void;
}

/**
 * Aba "Balanço & Liberdade" — Dossiês de Balanço 360° e Liberdade Financeira,
 * além dos cards de Patrimônio Líquido Real, Grau de Liberdade e Runway.
 */
export function BalanceTab({
  consolidatedBalance,
  freedomAnalysis,
  onOpenConsolidatedWealth,
  onOpenDividendFreedom,
}: BalanceTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Card Duplo de Dossiês A4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <Scale className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <h3 className="text-sm sm:text-base font-bold text-foreground">Balanço 360° & DRE Pessoal</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Relatório consolidado unindo investimentos, contas, dívidas, poupança e fluxo de caixa.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onOpenConsolidatedWealth}
            className="gap-2 w-full justify-center"
          >
            <Printer className="size-4" aria-hidden="true" />
            Visualizar Balanço 360°
          </Button>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <Flame className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <h3 className="text-sm sm:text-base font-bold text-foreground">Dossiê de Liberdade Financeira</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Análise da cobertura de custos por proventos, calendário 12M e efeito bola de neve.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onOpenDividendFreedom}
            className="gap-2 w-full justify-center"
          >
            <Printer className="size-4" aria-hidden="true" />
            Visualizar Dossiê de Liberdade
          </Button>
        </div>
      </div>

      {/* Cards de Patrimônio Líquido Real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Patrimônio Líquido Real</span>
            <EquationBreakdownPopover
              title="Patrimônio Líquido Real"
              description="Diferença entre todos os seus bens acumulados e as suas obrigações financeiras totais."
              formula="Ativos Totais (Investimentos + Caixa) − Passivos Totais (Dívidas + Faturas)"
              items={[
                {
                  label: "Investimentos & Ativos",
                  cents: numberToCents(consolidatedBalance.totalInvestmentsBRL),
                  sign: "+",
                  tone: "positive",
                },
                {
                  label: "Saldo em Caixa Bancário",
                  cents: numberToCents(consolidatedBalance.cashBalanceBRL),
                  sign: "+",
                  tone: "positive",
                },
                ...(consolidatedBalance.receivablesBRL > 0
                  ? [
                      {
                        label: "Recebíveis Previstos",
                        cents: numberToCents(consolidatedBalance.receivablesBRL),
                        sign: "+" as const,
                        tone: "positive" as const,
                      },
                    ]
                  : []),
                {
                  label: "Passivo Total (Dívidas + Faturas)",
                  cents: numberToCents(consolidatedBalance.totalLiabilitiesBRL),
                  sign: "-",
                  tone: "negative",
                },
              ]}
              totalLabel="Patrimônio Líquido Real"
              totalCents={numberToCents(consolidatedBalance.netWorthBRL)}
            />
          </div>
          <MoneyText
            cents={numberToCents(consolidatedBalance.netWorthBRL)}
            tone="portfolio"
            animated
            className="text-lg sm:text-xl font-bold font-display tabular-nums whitespace-nowrap"
          />
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Grau de Liberdade Financeira</span>
            <EquationBreakdownPopover
              title="Grau de Liberdade Financeira (FIRE)"
              description="Percentual das despesas mensais cobertas exclusivamente pelo fluxo de proventos passivos."
              formula="(Proventos Médios Mensais / Despesas Médias Mensais) × 100"
              items={[
                {
                  label: "Proventos Mensais da Carteira",
                  cents: numberToCents(freedomAnalysis.monthlyDividendsBRL),
                  sign: "+",
                  tone: "positive",
                  hint: "Renda passiva gerada por FIIs, Ações e Renda Fixa",
                },
                {
                  label: "Custo de Vida Mensal Médio",
                  cents: numberToCents(freedomAnalysis.monthlyExpensesBRL),
                  sign: "=",
                  tone: "default",
                  hint: "Gasto médio mensal de referência",
                },
              ]}
              totalLabel="Proventos Mensais"
              totalCents={numberToCents(freedomAnalysis.monthlyDividendsBRL)}
            />
          </div>
          <span className="text-lg sm:text-xl font-bold font-display text-positive-strong">
            {formatPercent(freedomAnalysis.freedomPct)}%
          </span>
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Autonomia de Reserva (Runway)</span>
            <EquationBreakdownPopover
              title="Autonomia de Reserva (Runway)"
              description="Tempo em meses que suas reservas de alta liquidez suportam o custo de vida sem novas receitas."
              formula="Reservas Líquidas / Despesas Médias Mensais"
              items={[
                {
                  label: "Reservas Líquidas Totais",
                  cents: numberToCents(freedomAnalysis.liquidReservesBRL),
                  sign: "+",
                  tone: "positive",
                  hint: "Caixa imediato e reservas de emergência",
                },
                {
                  label: "Custo de Vida Mensal",
                  cents: numberToCents(freedomAnalysis.monthlyExpensesBRL),
                  sign: "=",
                  tone: "default",
                  hint: "Gasto médio mensal suportado",
                },
              ]}
              totalLabel="Reservas Líquidas"
              totalCents={numberToCents(freedomAnalysis.liquidReservesBRL)}
            />
          </div>
          <span className="text-lg sm:text-xl font-bold font-display text-foreground">
            {formatPercent(freedomAnalysis.runwayMonths)} meses
          </span>
        </div>
      </div>
    </div>
  );
}
