import { useState, useMemo } from "react";
import { Landmark } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportFooter,
  ReportRunningHeader,
} from "@/components/modules";
import { Alert } from "@/components/ui";
import { isCashAssetClass, calculateTotalCostBRL } from "@/domain/portfolio";
import { OFFICIAL_TAX_FACILITATOR_DISCLAIMER } from "@/lib/institutional";
import type { PortfolioAsset, PortfolioDividend } from "@/types";
import { TaxBensDireitosSection } from "./tax-facilitator/TaxBensDireitosSection";
import { TaxRendimentosSection } from "./tax-facilitator/TaxRendimentosSection";
import {
  buildExemptDividendsByAsset,
  buildTaxItemDetails,
} from "./tax-facilitator/tax-facilitator-utils";

export interface TaxFacilitatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: readonly PortfolioAsset[];
  dividends: readonly PortfolioDividend[];
  usdRate?: number;
  appName?: string;
  accountHolder?: string;
}

/**
 * Facilitador de Declaração de IRPF Anual (F40/F42/F44).
 * Apresenta discriminações formatadas para cópia no programa da Receita Federal
 * e consolidação de rendimentos isentos/exclusivos em layout A4 de alta densidade contábil.
 */
export function TaxFacilitatorModal({
  open,
  onOpenChange,
  assets,
  dividends,
  usdRate = 5.25,
  appName = "Axir",
  accountHolder,
}: TaxFacilitatorModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const calendarYear = currentYear - 1;

  const nonCashAssets = useMemo(
    () => assets.filter((a) => !isCashAssetClass(a.asset_class) && a.quantity > 0),
    [assets],
  );

  const taxItems = useMemo(
    () => nonCashAssets.map((asset) => buildTaxItemDetails(asset, usdRate)),
    [nonCashAssets, usdRate],
  );

  const totalCostAllAssetsBRL = useMemo(
    () => calculateTotalCostBRL(nonCashAssets, usdRate),
    [nonCashAssets, usdRate],
  );

  const rendimentosPorAtivo = useMemo(
    () => buildExemptDividendsByAsset(nonCashAssets, dividends, calendarYear),
    [nonCashAssets, dividends, calendarYear],
  );

  const totalRendimentosBRL = useMemo(
    () => rendimentosPorAtivo.reduce((acc, r) => acc + r.amountBRL, 0),
    [rendimentosPorAtivo],
  );

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Silencioso em falhas de clipboard
    }
  };

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Dossiê Fiscal & Facilitador de IRPF"
      documentTitle={`AXIR_Facilitador_IRPF_AnoBase_${calendarYear}.pdf`}
    >
      <ReportHeader
        title={`Facilitador de Declaração de IRPF — Ano-Base ${calendarYear}`}
        subtitle="Bens & Direitos (Discriminação Pronta) e Rendimentos Isentos & Exclusivos"
        periodLabel={`Exercício ${currentYear}`}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      <ReportRunningHeader
        title={`Facilitador de Declaração de IRPF — Ano-Base ${calendarYear}`}
        periodLabel={`Exercício ${currentYear}`}
      />

      <div className="print:hidden">
        <Alert variant="info">
          Utilize o botão de cópia rápida para preencher o campo &quot;Discriminação&quot; diretamente no programa da Receita Federal. Valores calculados pelo Preço Médio Ponderado. Cálculos de caráter estimativo e auxiliar que não substituem o trabalho de um contador habilitado nem a Declaração de Ajuste Anual.
        </Alert>
      </div>

      <TaxBensDireitosSection
        items={taxItems}
        totalCostAllAssetsBRL={totalCostAllAssetsBRL}
        calendarYear={calendarYear}
        copiedKey={copiedKey}
        onCopy={(key, text) => void handleCopy(key, text)}
      />

      <TaxRendimentosSection
        items={rendimentosPorAtivo}
        totalRendimentosBRL={totalRendimentosBRL}
        calendarYear={calendarYear}
      />

      <ReportFooter
        accountHolder={accountHolder}
        disclaimer={OFFICIAL_TAX_FACILITATOR_DISCLAIMER}
        reportType="irpf"
        showQrCode
      />
    </ReportDocumentLayout>
  );
}
