import { useMemo } from "react";
import { Scale } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportRunningHeader,
  ReportExecutiveSummary,
  ReportFooter,
} from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { ConsolidatedBalanceSheetResult } from "@/domain/reports";
import { formatPercent } from "@/services/masks";
import { OFFICIAL_CVM_DISCLAIMER } from "@/lib/institutional";
import { ConsolidatedBalanceSection } from "./consolidated-wealth/ConsolidatedBalanceSection";

export interface ConsolidatedWealthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceSheet: ConsolidatedBalanceSheetResult;
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
}

/**
 * Balanço Patrimonial 360° & DRE Pessoal Integrada (F42/F44).
 * Visão holística de Ativos, Passivos, Patrimônio Líquido Real e Alavancagem.
 * Projetado para ajuste em 1 página A4 com aproveitamento de 2 colunas.
 */
export function ConsolidatedWealthModal({
  open,
  onOpenChange,
  balanceSheet,
  periodLabel = "Fechamento Consolidado",
  appName = "Axir",
  accountHolder,
}: ConsolidatedWealthModalProps) {
  const totalAssets = balanceSheet.totalAssetsBRL;
  const pctOfAssets = (v: number) => (totalAssets > 0 ? (v / totalAssets) * 100 : 0);

  const assetSegments = useMemo(
    () => [
      {
        key: "investments",
        label: "Investimentos em Custódia",
        value: balanceSheet.totalInvestmentsBRL,
        pct: pctOfAssets(balanceSheet.totalInvestmentsBRL),
        color: "hsl(var(--primary-strong))",
        formattedValue: <MoneyText cents={numberToCents(balanceSheet.totalInvestmentsBRL)} />,
      },
      {
        key: "cash",
        label: "Reserva de Caixa (Liquidez)",
        value: balanceSheet.cashBalanceBRL,
        pct: pctOfAssets(balanceSheet.cashBalanceBRL),
        color: "hsl(var(--cat-7))",
        formattedValue: <MoneyText cents={numberToCents(balanceSheet.cashBalanceBRL)} />,
      },
      {
        key: "receivables",
        label: "Contas a Receber",
        value: balanceSheet.receivablesBRL,
        pct: pctOfAssets(balanceSheet.receivablesBRL),
        color: "hsl(var(--portfolio))",
        formattedValue: <MoneyText cents={numberToCents(balanceSheet.receivablesBRL)} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totalAssets, balanceSheet.totalInvestmentsBRL, balanceSheet.cashBalanceBRL, balanceSheet.receivablesBRL],
  );

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Balanço Patrimonial 360° & Evolução Líquida"
      documentTitle="AXIR_Balanco_Patrimonial_360.pdf"
    >
      <ReportHeader
        title="Balanço Patrimonial 360° & Visão Consolidada"
        subtitle="Ativos Totais, Passivos Exigíveis, Patrimônio Líquido & Alavancagem"
        periodLabel={periodLabel}
        appName={appName}
        icon={Scale}
        accountHolder={accountHolder}
      />

      <ReportRunningHeader
        title="Balanço Patrimonial 360°"
        periodLabel={periodLabel}
      />

      <ReportExecutiveSummary
        title="SÍNTESE PATRIMONIAL & GRAU DE ALAVANCAGEM"
        items={[
          {
            label: "Patrimônio Líquido",
            value: <MoneyText cents={numberToCents(balanceSheet.netWorthBRL)} tone="portfolio" />,
            subtext: "Ativos (-) Passivos",
          },
          {
            label: "Ativos Totais",
            value: <MoneyText cents={numberToCents(balanceSheet.totalAssetsBRL)} tone="positive" />,
            subtext: "Custódia + Caixa",
          },
          {
            label: "Passivos Exigíveis",
            value: <MoneyText cents={numberToCents(balanceSheet.totalLiabilitiesBRL)} tone="negative" />,
            subtext: "Dívidas Totais",
          },
          {
            label: "Grau de Alavancagem",
            value: `${formatPercent(balanceSheet.debtToAssetRatioPct)}%`,
            subtext: "Dívida / Ativos",
          },
        ]}
      />

      <ConsolidatedBalanceSection
        balanceSheet={balanceSheet}
        assetSegments={assetSegments}
      />

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_CVM_DISCLAIMER}
        reportType="balance"
        showQrCode
      />
    </ReportDocumentLayout>
  );
}
