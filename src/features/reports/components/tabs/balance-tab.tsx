import { Flame, Printer, Scale } from "lucide-react";
import { Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
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
              <Scale className="size-5 text-primary-strong shrink-0" aria-hidden="true" />
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
              <Flame className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
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
          <span className="text-xs text-muted-foreground">Patrimônio Líquido Real</span>
          <MoneyText
            cents={numberToCents(consolidatedBalance.netWorthBRL)}
            tone="portfolio"
            animated
            className="text-lg sm:text-xl font-bold font-display truncate"
          />
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Grau de Liberdade Financeira</span>
          <span className="text-lg sm:text-xl font-bold font-display text-positive-strong">
            {freedomAnalysis.freedomPct.toFixed(1)}%
          </span>
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Autonomia de Reserva (Runway)</span>
          <span className="text-lg sm:text-xl font-bold font-display text-foreground">
            {freedomAnalysis.runwayMonths.toFixed(1)} meses
          </span>
        </div>
      </div>
    </div>
  );
}
