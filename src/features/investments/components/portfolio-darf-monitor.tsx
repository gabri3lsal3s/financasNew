import { useMemo, useState } from "react";
import { Calendar, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge, Modal, MoneyText } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { computeMonthlyDarfReport } from "@/domain/portfolio/darf-reconstitution";
import { currentMonth } from "@/lib/date";
import { OFFICIAL_TAX_DISCLAIMER } from "@/lib/institutional";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";
import { DarfCategoryCard } from "./darf-monitor/darf-category-card";

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

  const { darf, salesCount } = useMemo(
    () =>
      computeMonthlyDarfReport({
        month: selectedMonth,
        assets,
        transactions,
      }),
    [selectedMonth, assets, transactions],
  );

  const hasAccumulatedLosses =
    darf.stockCompensatedLossCents > 0 ||
    darf.fiiCompensatedLossCents > 0 ||
    darf.etfCompensatedLossCents > 0 ||
    darf.remainingAccumulatedLossCents.stockCents > 0 ||
    darf.remainingAccumulatedLossCents.fiiCents > 0 ||
    darf.remainingAccumulatedLossCents.etfCents > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Monitor Mensal de DARF & Isenção de 20k"
      description="Apuração de impostos sobre vendas em bolsa de valores e controle de isenções fiscais."
      size="xl"
    >
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-surface-raised p-3.5">
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">Mês de Apuração:</span>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[230px]">
            <MonthPicker value={selectedMonth} onValueChange={setSelectedMonth} />
          </div>
        </div>

        {darf.shouldPayDarf ? (
          <div className="flex flex-col gap-2 rounded-xl border border-warning/25 bg-warning/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
          <div className="flex items-center gap-3 rounded-xl border border-positive/25 bg-positive/10 p-4">
            <ShieldCheck className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <strong className="text-xs font-semibold text-foreground">Sem DARF a recolher no período</strong>
              <p className="text-[11px] text-muted-foreground">
                {salesCount === 0
                  ? "Nenhuma operação de venda realizada neste mês."
                  : darf.isStockExempt && darf.etfTaxDueCents === 0 && darf.fiiTaxDueCents === 0
                    ? "Vendas de ações dentro do limite de isenção de R$ 20.000/mês e sem outros tributos devidos."
                    : "Sem lucro líquido tributável no período."}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DarfCategoryCard
            title="Ações B3"
            badgeLabel={darf.isStockExempt ? "Isento (≤ 20k)" : "Tributável (15%)"}
            badgeVariant={darf.isStockExempt ? "positive" : "warning"}
            salesVolumeCents={darf.stockSalesVolumeCents}
            grossProfitCents={darf.stockGrossProfitCents}
            taxDueCents={darf.stockTaxDueCents}
          />

          <DarfCategoryCard
            title="Fundos Imobiliários (FIIs)"
            badgeLabel="Alíquota 20%"
            badgeVariant="muted"
            salesVolumeCents={darf.fiiSalesVolumeCents}
            grossProfitCents={darf.fiiGrossProfitCents}
            taxDueCents={darf.fiiTaxDueCents}
          />

          {darf.etfSalesVolumeCents > 0 ? (
            <DarfCategoryCard
              title="ETFs & BDRs B3"
              badgeLabel="Sem Isenção (15%)"
              badgeVariant="warning"
              salesVolumeCents={darf.etfSalesVolumeCents}
              grossProfitCents={darf.etfGrossProfitCents}
              taxDueCents={darf.etfTaxDueCents}
            />
          ) : null}

          {darf.foreignSalesVolumeCents > 0 ? (
            <DarfCategoryCard
              title="Exterior (Lei 14.754/2023)"
              badgeLabel="IRPF Anual DAA"
              badgeVariant="portfolio"
              salesVolumeCents={darf.foreignSalesVolumeCents}
              grossProfitLabel="Ganho de Capital:"
              grossProfitCents={darf.foreignGrossProfitCents}
              taxDueFallbackText="Isento no mês (DAA)"
            />
          ) : null}
        </div>

        {hasAccumulatedLosses ? (
          <div className="flex flex-col gap-2.5 rounded-xl border border-portfolio/25 bg-portfolio/5 p-3.5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xs font-semibold text-foreground">
                Prejuízos Acumulados &amp; Compensações (Art. 56)
              </strong>
              <Badge variant="portfolio" size="xs">
                Crédito Fiscal
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {darf.remainingAccumulatedLossCents.stockCents > 0 ? (
                <div className="flex items-center justify-between sm:flex-col sm:items-start p-2.5 rounded-lg bg-surface-raised">
                  <span className="text-muted-foreground text-[11px]">Ações a Compensar:</span>
                  <MoneyText cents={darf.remainingAccumulatedLossCents.stockCents} tone="portfolio" className="font-semibold" />
                </div>
              ) : null}
              {darf.remainingAccumulatedLossCents.fiiCents > 0 ? (
                <div className="flex items-center justify-between sm:flex-col sm:items-start p-2.5 rounded-lg bg-surface-raised">
                  <span className="text-muted-foreground text-[11px]">FIIs a Compensar:</span>
                  <MoneyText cents={darf.remainingAccumulatedLossCents.fiiCents} tone="portfolio" className="font-semibold" />
                </div>
              ) : null}
              {darf.remainingAccumulatedLossCents.etfCents > 0 ? (
                <div className="flex items-center justify-between sm:flex-col sm:items-start p-2.5 rounded-lg bg-surface-raised">
                  <span className="text-muted-foreground text-[11px]">ETFs a Compensar:</span>
                  <MoneyText cents={darf.remainingAccumulatedLossCents.etfCents} tone="portfolio" className="font-semibold" />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground leading-relaxed">
          <ShieldAlert className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <span>{OFFICIAL_TAX_DISCLAIMER}</span>
        </div>
      </div>
    </Modal>
  );
}
