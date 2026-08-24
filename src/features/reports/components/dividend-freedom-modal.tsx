import { usePrint } from "@/components/ui";
import { CalendarDays, Flame, PiggyBank, Printer, Sparkles } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { PrintSheet } from "@/components/ui/print-sheet";
import { numberToCents } from "@/domain/money";
import type { FreedomAnalysisResult } from "@/domain/reports";
import type { PortfolioDividend } from "@/types";

export interface DividendFreedomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freedomAnalysis: FreedomAnalysisResult;
  dividends: readonly PortfolioDividend[];
  yearDividendsBRL: number;
  periodLabel?: string;
  appName?: string;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function DividendFreedomModal({
  open,
  onOpenChange,
  freedomAnalysis,
  dividends,
  yearDividendsBRL,
  periodLabel = "Exercício Anual",
  appName = "Finanças Pessoais",
}: DividendFreedomModalProps) {
  const { printing, triggerPrint } = usePrint();
  const generatedAt = new Date().toLocaleDateString("pt-BR");

  const currentYear = new Date().getFullYear();


  // Matriz de 12 meses de proventos do ano corrente
  const monthlyTotals = Array.from({ length: 12 }, (_, idx) => {
    const monthStr = `${currentYear}-${String(idx + 1).padStart(2, "0")}`;
    const sum = dividends
      .filter((d) => d.date.startsWith(monthStr))
      .reduce((acc, d) => acc + d.amount, 0);
    return { month: MONTH_NAMES[idx], sum };
  });

  const maxMonthValue = Math.max(1, ...monthlyTotals.map((m) => m.sum));

  const reportContent = (
    <div className="print-area flex flex-col gap-6 bg-surface text-foreground w-full max-w-full overflow-hidden print:overflow-visible">
      {/* Cabeçalho Institucional */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4 print:flex-row print:items-start">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-positive/10 border border-positive/20 text-positive-strong">
            <PiggyBank className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-foreground">{appName}</span>
            <span className="text-xs text-muted-foreground">Dossiê de Proventos, Renda Passiva &amp; Liberdade Financeira</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground print:items-end print:text-right">
          <span className="font-medium text-foreground">{periodLabel}</span>
          <span>Emitido em {generatedAt}</span>
        </div>

      </header>

      {/* Grade de KPIs de Renda Passiva */}
      <section aria-label="Indicadores de Renda" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Proventos no Ano</span>
          <MoneyText cents={numberToCents(yearDividendsBRL)} tone="positive" className="text-base sm:text-lg font-bold" />
        </div>
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Média Mensal de Proventos</span>
          <MoneyText cents={numberToCents(freedomAnalysis.monthlyDividendsBRL)} tone="positive" className="text-base sm:text-lg font-bold" />
        </div>
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Cobertura do Custo de Vida</span>
          <span className="num text-base sm:text-lg font-bold text-positive-strong">
            {freedomAnalysis.freedomPct.toFixed(1)}%
          </span>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Autonomia (Runway Reserva)</span>
          <span className="num text-base sm:text-lg font-bold text-foreground">
            {freedomAnalysis.runwayMonths.toFixed(1)} meses
          </span>
        </div>
      </section>

      {/* Seção 1: Termômetro do Estágio de Liberdade Financeira */}
      <section aria-label="Termômetro de Liberdade" className="rounded-xl border border-border/80 bg-surface-hover/20 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-primary-strong" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Estágio de Independência Financeira</h3>
          </div>
          <span className="text-xs font-bold text-primary-strong">{freedomAnalysis.stageLabel}</span>
        </div>
        <div className="w-full bg-surface-hover rounded-full h-3.5 overflow-hidden border border-border">
          <div
            className="bg-positive-strong h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(3, freedomAnalysis.freedomPct))}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>0% (Início)</span>
          <span>25% (1º Quarto)</span>
          <span>50% (Metade)</span>
          <span>75% (Segurança)</span>
          <span>100% (Independência Plena)</span>
        </div>
      </section>

      {/* Seção 2: Calendário de 12 Meses de Rendimentos */}
      <section aria-label="Calendário Anual" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-portfolio" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Fluxo Mensal de Rendimentos ({currentYear})</h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2">
          {monthlyTotals.map((m) => {
            const heightPct = Math.max(10, Math.round((m.sum / maxMonthValue) * 100));
            return (
              <div key={m.month} className="rounded-lg border border-border/70 bg-surface-hover/30 p-2 flex flex-col items-center gap-1.5 justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">{m.month}</span>
                <div className="w-full bg-surface-hover/80 h-14 rounded flex items-end p-0.5">
                  <div
                    className="w-full bg-positive-strong/70 rounded-xs transition-all"
                    style={{ height: m.sum > 0 ? `${heightPct}%` : "4px" }}
                  />
                </div>
                <span className="text-[10px] font-mono font-medium text-foreground">
                  {m.sum > 0 ? `R$ ${Math.round(m.sum)}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Seção 3: Diagnóstico do Efeito Bola de Neve */}
      <section aria-label="Efeito Bola de Neve" className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-portfolio" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Ativos no Efeito Bola de Neve (Reinvestimento Próprio)</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {freedomAnalysis.totalSnowballAssetsCount} ativo(s) auto-sustentável(is)
          </span>
        </div>
        {freedomAnalysis.snowballAssets.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                  <th className="py-2.5 px-3">Ticker</th>
                  <th className="py-2.5 px-3 text-right">Preço Atual</th>
                  <th className="py-2.5 px-3 text-right">Renda Mensal Gerada</th>
                  <th className="py-2.5 px-3 text-right">Cotas Compradas / Mês</th>
                  <th className="py-2.5 px-3 text-center">Status da Bola de Neve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {freedomAnalysis.snowballAssets.map((sb) => (
                  <tr key={sb.ticker} className="hover:bg-surface-hover/30">
                    <td className="py-2 px-3 font-semibold text-foreground">{sb.ticker}</td>
                    <td className="py-2 px-3 text-right font-mono"><MoneyText cents={numberToCents(sb.currentPriceBRL)} /></td>
                    <td className="py-2 px-3 text-right font-mono text-positive-strong font-medium">
                      <MoneyText cents={numberToCents(sb.monthlyIncomeGeneratedBRL)} />
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                      {sb.newSharesPerMonth.toFixed(2)} cota(s)
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          sb.isSnowballReached
                            ? "bg-positive/10 text-positive-strong border border-positive/20"
                            : "bg-surface-hover text-muted-foreground border border-border"
                        }`}
                      >
                        {sb.isSnowballReached ? "Bola de Neve Ativa!" : `${Math.ceil(sb.monthsToBuyOneShare)} mês(es) p/ 1 cota`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Nenhum ativo com proventos mensais cadastrados no momento.
          </p>
        )}
      </section>

      {/* Rodapé da Página A4 */}
      <footer className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
        <span>{appName} — Inteligência de Renda Passiva</span>
        <span>Página 1 de 1</span>
      </footer>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Dossiê de Proventos &amp; Liberdade Financeira"
        description="Análise do fluxo de rendimentos passivos, cobertura de despesas e efeito bola de neve."
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
