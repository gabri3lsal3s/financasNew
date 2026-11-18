import { useCallback } from "react";
import type { ExportCsvKind, ExportRange } from "@/components/modules";
import { numberToCents } from "@/domain/money";
import {
  serializeExpensesCsv,
  serializeIncomesCsv,
  serializeInvoicesCsv,
  serializePositionsCsv,
  type ExportExpenseRow,
  type ExportIncomeRow,
  type ExportInvoiceRow,
  type ExportPositionRow,
} from "@/domain/export";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { downloadCsv } from "@/services/export-actions";
import {
  useCategories,
  useCreditCards,
  useExportData,
  usePortfolioPosition,
} from "@/state";

interface BackupExpenseItem {
  date: string;
  description?: string | null;
  category_id: string;
  value: number;
  report_weight?: number | null;
  payment_method: "cash" | "debit" | "credit_card" | "pix" | "transfer" | "other";
  card_id?: string | null;
  installment_number?: number | null;
  installments_total?: number | null;
}

interface BackupIncomeItem {
  date: string;
  description?: string | null;
  category_id: string;
  value: number;
  report_weight?: number | null;
  receive_type: "cash" | "pix" | "transfer" | "other";
}

interface BackupCardPaymentItem {
  competence_month: string;
  card_id: string;
  amount: number;
  date: string;
  note?: string | null;
  is_refund?: boolean;
}

function rangeStamp(range: ExportRange): string {
  return `${range.start.slice(0, 10)}_a_${range.end.slice(0, 10)}`;
}

export function useSettingsCsvExport() {
  const portfolioPosition = usePortfolioPosition();
  const exportDataQuery = useExportData({ enabled: false });
  const categoriesQuery = useCategories();
  const creditCardsQuery = useCreditCards();

  const handleExportCsv = useCallback(
    async (kind: ExportCsvKind, range: ExportRange): Promise<void> => {
      const stamp = rangeStamp(range);
      const categories = categoriesQuery.data ?? [];
      const cards = creditCardsQuery.data ?? [];
      const categoryName = new Map(categories.map((c) => [c.id, c.name]));
      const cardName = new Map(cards.map((c) => [c.id, c.name]));

      const { data: payload } = await exportDataQuery.refetch();

      if (kind === "expenses") {
        const expenses = ((payload?.data.expenses ?? []) as unknown as BackupExpenseItem[]).filter(
          (e) => e.date >= range.start && e.date < range.end,
        );
        const csvRows: ExportExpenseRow[] = expenses.map((e) => ({
          date: e.date,
          description: e.description ?? "",
          categoryName: categoryName.get(e.category_id) ?? "Sem categoria",
          valueCents: numberToCents(e.value),
          reportValueCents: numberToCents(e.value * (e.report_weight ?? 1)),
          paymentMethodLabel: PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method,
          cardName: e.card_id ? (cardName.get(e.card_id) ?? null) : null,
          installments:
            (e.installments_total ?? 1) > 1
              ? `${e.installment_number}/${e.installments_total}`
              : "—",
        }));
        downloadCsv(`despesas_${stamp}.csv`, serializeExpensesCsv(csvRows));
        return;
      }

      if (kind === "incomes") {
        const incomes = ((payload?.data.incomes ?? []) as unknown as BackupIncomeItem[]).filter(
          (i) => i.date >= range.start && i.date < range.end,
        );
        const csvRows: ExportIncomeRow[] = incomes.map((i) => ({
          date: i.date,
          description: i.description ?? "",
          categoryName: categoryName.get(i.category_id) ?? "Sem categoria",
          valueCents: numberToCents(i.value),
          reportValueCents: numberToCents(i.value * (i.report_weight ?? 1)),
          receiveTypeLabel: RECEIVE_TYPE_LABELS[i.receive_type] ?? i.receive_type,
        }));
        downloadCsv(`receitas_${stamp}.csv`, serializeIncomesCsv(csvRows));
        return;
      }

      if (kind === "invoices") {
        const payments = (
          (payload?.data.card_payments ?? []) as unknown as BackupCardPaymentItem[]
        ).filter((p) => p.date >= range.start && p.date < range.end);
        const csvRows: ExportInvoiceRow[] = payments.map((p) => ({
          competenceMonth: p.competence_month,
          cardName: cardName.get(p.card_id) ?? "Cartão removido",
          amountCents: numberToCents(p.amount),
          date: p.date,
          note: p.note ?? null,
          isRefund: Boolean(p.is_refund),
        }));
        downloadCsv(`faturas_${stamp}.csv`, serializeInvoicesCsv(csvRows));
        return;
      }

      const csvRows: ExportPositionRow[] = portfolioPosition.rows.map((r) => ({
        ticker: r.ticker,
        assetClass: r.assetClass,
        currency: r.currency,
        quantity: r.quantity,
        averageCost: r.averageCost,
        priceBRL: r.priceBRL,
        valueBRL: r.valueBRL,
        unrealizedPnl: r.unrealizedPnl,
        unrealizedPct: r.unrealizedPct,
        pct: r.pct,
      }));
      downloadCsv(`posicoes_${stamp}.csv`, serializePositionsCsv(csvRows));
    },
    [categoriesQuery.data, creditCardsQuery.data, exportDataQuery, portfolioPosition.rows],
  );

  return { handleExportCsv };
}
