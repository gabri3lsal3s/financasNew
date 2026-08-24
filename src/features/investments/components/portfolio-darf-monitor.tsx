import { useState } from "react";
import { Calendar, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { calculateMonthlyDarf } from "@/domain/portfolio";
import { currentMonth } from "@/lib/date";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

export interface PortfolioDarfMonitorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: PortfolioAsset[];
  transactions: PortfolioTransaction[];
}

/**
 * Monitor Mensal de DARF & Isenção de 20k em Renda Variável (§F40).
 */
export function PortfolioDarfMonitor({
  open,
  onOpenChange,
  assets,
  transactions,
}: PortfolioDarfMonitorProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonth());

  const assetMap = new Map(assets.map((a) => [a.id, a]));

  // Filtra operações de venda do mês selecionado
  const monthSales = transactions
    .filter((t) => t.date.startsWith(selectedMonth) && t.type === "sell")
    .map((t) => {
      const asset = assetMap.get(t.asset_id);
      const ticker = asset?.ticker ?? "Ativo";
      const assetClass = asset?.asset_class ?? null;
      const averagePrice = asset?.average_price ?? t.price;
      const costAmountCents = Math.round(t.quantity * averagePrice * 100);
      const saleAmountCents = Math.round(t.total * 100);
      const profitCents = saleAmountCents - costAmountCents;

      return {
        ticker,
        assetClass,
        saleAmountCents,
        costAmountCents,
        profitCents,
      };
    });

  const darf = calculateMonthlyDarf({
    month: selectedMonth,
    sales: monthSales,
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Monitor Mensal de DARF & Isenção de 20k"
      description="Apuração de impostos sobre vendas em bolsa de valores e controle de isenções fiscais."
      size="xl"
    >
      <div className="flex flex-col gap-4 mt-3">
        {/* Seletor do Mês de Competência */}
        <div className="flex items-center justify-between gap-3 bg-surface-hover/40 p-3 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-portfolio" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">Mês de Apuração:</span>
          </div>
          <MonthPicker value={selectedMonth} onValueChange={setSelectedMonth} aria-label="Mês de apuração do DARF" />
        </div>

        {/* Status Geral de DARF */}
        {darf.shouldPayDarf ? (
          <div className="flex flex-col gap-2 rounded-xl border border-warning-border/80 bg-warning-surface/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-warning-strong text-sm">
                <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                <span>DARF a Recolher neste Mês</span>
              </div>
              <MoneyText cents={darf.totalTaxDueCents} tone="portfolio" className="text-base font-bold" />
            </div>
            <p className="text-xs text-muted-foreground">
              O valor apurado deve ser recolhido via DARF até o último dia útil do mês subsequente (Código 6015).
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-positive-border/80 bg-positive-surface/30 p-4">
            <ShieldCheck className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <strong className="text-xs font-semibold text-foreground">Sem DARF a recolher no período</strong>
              <p className="text-[11px] text-muted-foreground">
                {monthSales.length === 0
                  ? "Nenhuma operação de venda realizada neste mês."
                  : darf.isStockExempt
                    ? "Vendas de ações dentro do limite de isenção de R$ 20.000/mês."
                    : "Sem lucro líquido tributável no período."}
              </p>
            </div>
          </div>
        )}

        {/* Resumo por Categoria */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Bloco de Ações */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <strong className="text-xs font-semibold text-foreground">Ações & ETFs</strong>
              <Badge variant={darf.isStockExempt ? "positive" : "warning"} className="text-[10px]">
                {darf.isStockExempt ? "Isento" : "Tributável (15%)"}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Volume de Vendas:</span>
                <MoneyText cents={darf.stockSalesVolumeCents} tone="default" />
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Lucro Bruto:</span>
                <MoneyText cents={darf.stockGrossProfitCents} tone="auto" />
              </div>
              <div className="flex items-center justify-between font-medium pt-1 border-t border-border/30">
                <span className="text-foreground">Imposto Devido:</span>
                <MoneyText cents={darf.stockTaxDueCents} tone={darf.stockTaxDueCents > 0 ? "negative" : "default"} />
              </div>
            </div>
          </div>

          {/* Bloco de FIIs */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <strong className="text-xs font-semibold text-foreground">Fundos Imobiliários (FIIs)</strong>
              <Badge variant="muted" className="text-[10px]">
                Alíquota 20%
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Volume de Vendas:</span>
                <MoneyText cents={darf.fiiSalesVolumeCents} tone="default" />
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Lucro Bruto:</span>
                <MoneyText cents={darf.fiiGrossProfitCents} tone="auto" />
              </div>
              <div className="flex items-center justify-between font-medium pt-1 border-t border-border/30">
                <span className="text-foreground">Imposto Devido:</span>
                <MoneyText cents={darf.fiiTaxDueCents} tone={darf.fiiTaxDueCents > 0 ? "negative" : "default"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
