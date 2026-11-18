import { debtStatus } from "@/domain/debts";
import { serializeDebtsCsv, type ExportDebtRow } from "@/domain/export";
import { numberToCents } from "@/domain/money";
import { downloadCsv } from "@/services/export-actions";
import type { Debt, Loan } from "@/types";

export interface ExportDebtsCsvParams {
  tab: "payable" | "receivable" | "loans";
  loans: readonly Loan[];
  payableDebts: readonly Debt[];
  receivableDebts: readonly Debt[];
  showPaid: boolean;
  today: string;
}

/** Serializa e dispara o download CSV de contas a pagar/receber ou contratos ativos. */
export function useExportDebtsCsv() {
  return ({ tab, loans, payableDebts, receivableDebts, showPaid, today }: ExportDebtsCsvParams) => {
    if (tab === "loans") {
      if (loans.length === 0) return;
      const rows: ExportDebtRow[] = loans.map((loan) => ({
        name: loan.name,
        type: "payable",
        status: "Ativo",
        amountCents: numberToCents(loan.principal_amount),
        dueDate: loan.start_date,
        paidAt: null,
        notes: `Taxa: ${loan.interest_rate_monthly}% a.m. | Parcelas: ${loan.total_installments}x (${loan.amortization_system})`,
      }));
      downloadCsv(`financiamentos_${today}.csv`, serializeDebtsCsv(rows));
      return;
    }

    const currentList = tab === "payable" ? payableDebts : receivableDebts;
    const filteredList = showPaid ? currentList : currentList.filter((d) => !d.paid_at);
    if (filteredList.length === 0) return;

    const rows: ExportDebtRow[] = filteredList.map((d) => {
      const status = debtStatus(d.due_date, d.paid_at, today);
      let statusLabel = "Pendente";
      if (status === "paid") statusLabel = "Quitada";
      else if (status === "overdue") statusLabel = "Atrasada";
      else if (status === "due_today") statusLabel = "Vence Hoje";

      return {
        name: d.name,
        type: d.type,
        status: statusLabel,
        amountCents: numberToCents(d.amount),
        dueDate: d.due_date,
        paidAt: d.paid_at ?? null,
        notes: null,
      };
    });

    const filePrefix = tab === "payable" ? "contas_a_pagar" : "contas_a_receber";
    const statusSlug = showPaid ? "todas" : "pendentes";
    downloadCsv(`${filePrefix}_${statusSlug}_${today}.csv`, serializeDebtsCsv(rows));
  };
}
