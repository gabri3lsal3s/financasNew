import { Landmark } from "lucide-react";
import { EmptyState } from "@/components/ui";
import {
  ReportDocumentLayout,
  ReportHeader,
  ReportRunningHeader,
  ReportWaterfallBar,
  ReportFooter,
} from "@/components/modules";
import {
  evaluateDreReadiness,
  type DreSections,
  type ReportReadinessResult,
} from "@/domain/reports";
import type { ExcelBusinessDreData } from "@/services/excel-export";
import type {
  FinancialDREData,
  FinancialReportCategoryItem,
  FinancialReportHouseholdSummary,
  FinancialReportPaidInvoiceItem,
  FinancialReportPaymentMethodItem,
} from "./financial-close/financial-close-types";
import { FinancialCloseSummary } from "./financial-close/FinancialCloseSummary";
import { FinancialDreTable } from "./financial-close/FinancialDreTable";
import { FinancialCompositionTables } from "./financial-close/FinancialCompositionTables";
import { FinancialHouseholdSection } from "./financial-close/FinancialPaidInvoicesSection";
import { FinancialBusinessDreSection } from "./financial-close/FinancialBusinessDreSection";

export type {
  FinancialDREData,
  FinancialReportCategoryItem,
  FinancialReportPaymentMethodItem,
  FinancialReportPaidInvoiceItem,
  FinancialReportHouseholdSummary,
};

export interface FinancialCloseReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodLabel: string;
  appName?: string;
  accountHolder?: string;
  dre: FinancialDREData;
  categories: readonly FinancialReportCategoryItem[];
  paymentMethods: readonly FinancialReportPaymentMethodItem[];
  paidInvoices?: readonly FinancialReportPaidInvoiceItem[];
  expenseCount: number;
  incomeCount: number;
  showWeightedNote?: boolean;
  householdSummary?: FinancialReportHouseholdSummary | null;
  readiness?: ReportReadinessResult<DreSections>;
  businessDre?: ExcelBusinessDreData | null;
}

/**
 * Modal Executivo de Finanças Pessoais & DRE (F42/F44).
 *
 * Características canônicas:
 * - Página 1: Cabeçalho 70/30, Síntese de Fluxo, Cascata DRE e Demonstração do Resultado;
 * - Página 2: Running Header, Despesas por Categoria e Formas de Pagamento (omitida se despesas === 0);
 * - Recalcula dinamicamente totalPages (1 ou 2) eliminando páginas em branco;
 * - Zero centavos soltos e coluna dedicada Ponderado (R$) quando aplicável;
 * - Rodapé com prefixo funcional DRE- e chancela criptográfica.
 */
export function FinancialCloseReportModal({
  open,
  onOpenChange,
  periodLabel,
  appName = "Axir",
  accountHolder,
  dre,
  categories,
  paymentMethods,
  paidInvoices = [],
  expenseCount,
  incomeCount,
  showWeightedNote = false,
  householdSummary = null,
  readiness: propReadiness,
  businessDre = null,
}: FinancialCloseReportModalProps) {
  const effectiveGrossIncomeBruto = dre.grossIncomeBrutoCents ?? dre.grossIncomeCents;
  const effectiveTotalExpensesBruto = dre.totalExpensesBrutoCents ?? dre.totalExpensesCents;
  const effectiveGrossSavingsBruto = effectiveGrossIncomeBruto - effectiveTotalExpensesBruto;
  const effectiveGrossSavingsRatePct =
    effectiveGrossIncomeBruto > 0 ? (effectiveGrossSavingsBruto / effectiveGrossIncomeBruto) * 100 : 0;

  const hasBrutoRef =
    showWeightedNote &&
    (dre.grossIncomeBrutoCents !== undefined || dre.totalExpensesBrutoCents !== undefined);

  const hasBudgets = categories.some((c) => c.budgetLimitCents != null && c.budgetLimitCents > 0);

  const readiness =
    propReadiness ??
    evaluateDreReadiness({
      grossIncomeCents: effectiveGrossIncomeBruto,
      totalExpensesCents: effectiveTotalExpensesBruto,
      expenseCount,
      incomeCount,
      paidInvoicesCount: paidInvoices.length,
      hasWeightedDiscrepancy: hasBrutoRef,
      hasHousehold: Boolean(householdSummary),
    });

  const { sections } = readiness;
  const hasPage2 = sections.hasPage2;
  const totalPages = hasPage2 ? 2 : 1;

  const waterfallSteps = [
    {
      key: "income",
      label: "Receitas Realizadas",
      amountCents: effectiveGrossIncomeBruto,
      pctOfTotal: 100,
      type: "income" as const,
    },
    {
      key: "expenses",
      label: "Despesas Operacionais",
      amountCents: effectiveTotalExpensesBruto,
      pctOfTotal: effectiveGrossIncomeBruto > 0 ? (effectiveTotalExpensesBruto / effectiveGrossIncomeBruto) * 100 : 0,
      type: "expense" as const,
    },
    {
      key: "savings",
      label: "Poupança Líquida Operacional",
      amountCents: effectiveGrossSavingsBruto,
      pctOfTotal: effectiveGrossIncomeBruto > 0 ? (effectiveGrossSavingsBruto / effectiveGrossIncomeBruto) * 100 : 0,
      type: "savings" as const,
    },
  ];

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Relatório Executivo de Finanças Pessoais & DRE"
      documentTitle={`AXIR_DRE_Pessoal_${periodLabel.replace(/[^a-zA-Z0-9_-]+/g, "_")}.pdf`}
    >
      <ReportHeader
        title="Relatório Executivo de Finanças Pessoais & DRE"
        subtitle="Demonstração do Resultado, Fluxo de Caixa & Composição de Gastos"
        periodLabel={periodLabel}
        appName={appName}
        icon={Landmark}
        accountHolder={accountHolder}
      />

      {expenseCount === 0 && incomeCount === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={<Landmark className="size-8 text-muted-foreground" aria-hidden="true" />}
            title="Nenhuma transação encontrada para este período"
            description="Não há lançamentos de receitas ou despesas registrados na competência selecionada para a geração do Dossiê Contábil."
          />
        </div>
      ) : (
        <>
          <FinancialCloseSummary
            periodLabel={periodLabel}
            dre={dre}
            effectiveGrossIncomeBruto={effectiveGrossIncomeBruto}
            effectiveTotalExpensesBruto={effectiveTotalExpensesBruto}
            effectiveGrossSavingsBruto={effectiveGrossSavingsBruto}
            effectiveGrossSavingsRatePct={effectiveGrossSavingsRatePct}
            hasBrutoRef={hasBrutoRef}
          />

          {sections.waterfall && (
            <ReportWaterfallBar
              title="Fluxo Contábil & Destinação da Renda (Cascata DRE)"
              grossIncomeCents={effectiveGrossIncomeBruto}
              steps={waterfallSteps}
            />
          )}

          <FinancialDreTable
            dre={dre}
            incomeCount={incomeCount}
            expenseCount={expenseCount}
            effectiveGrossIncomeBruto={effectiveGrossIncomeBruto}
            effectiveTotalExpensesBruto={effectiveTotalExpensesBruto}
            effectiveGrossSavingsBruto={effectiveGrossSavingsBruto}
            effectiveGrossSavingsRatePct={effectiveGrossSavingsRatePct}
            hasBrutoRef={hasBrutoRef}
          />

          {businessDre && (businessDre.grossRevenueBRL > 0 || businessDre.operationalCostsBRL > 0) && (
            <FinancialBusinessDreSection businessDre={businessDre} />
          )}

          {hasPage2 ? (
            <>
              <ReportFooter
                accountHolder={accountHolder}
                reportType="dre"
                currentPage={1}
                totalPages={totalPages}
                disclaimer="Documento estritamente informativo emitido automaticamente com base nos registros financeiros e contábeis inseridos pelo titular da conta."
                showQrCode
                className="hidden print:flex"
              />

              {/* Seção Página 2 em Impressão */}
              <div className="print-break-before-page flex flex-col gap-4">
                <ReportRunningHeader
                  title="Relatório Executivo de Finanças Pessoais & DRE"
                  periodLabel={periodLabel}
                />

                <FinancialCompositionTables
                  categories={categories}
                  paymentMethods={paymentMethods}
                  paidInvoices={paidInvoices}
                  hasBrutoRef={hasBrutoRef}
                  hasBudgets={hasBudgets}
                />

                {householdSummary && <FinancialHouseholdSection householdSummary={householdSummary} />}
              </div>
            </>
          ) : null}
        </>
      )}

      <ReportFooter
        accountHolder={accountHolder}
        reportType="dre"
        currentPage={totalPages}
        totalPages={totalPages}
        disclaimer="Documento estritamente informativo emitido automaticamente com base nos registros financeiros e contábeis inseridos pelo titular da conta."
        showQrCode
      />
    </ReportDocumentLayout>
  );
}
