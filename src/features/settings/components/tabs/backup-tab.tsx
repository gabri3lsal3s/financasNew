import { RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@/components/ui";
import { ExportDataHub } from "@/components/modules";
import type { ExportCsvKind, ExportRange } from "@/components/modules";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { useTheme } from "@/app/theme-provider";
import { setDensity } from "@/hooks/use-density";
import { downloadCsv, downloadJson } from "@/services/export-actions";
import { todayLocalIso } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { numberToCents } from "@/domain/money";
import { BACKUP_TABLE_KEYS, parseBackupPayload } from "@/domain/export";
import type {
  ExportExpenseRow,
  ExportIncomeRow,
  ExportInvoiceRow,
  ExportPositionRow,
  RestoreSummary,
} from "@/domain/export";
import {
  serializeExpensesCsv,
  serializeIncomesCsv,
  serializeInvoicesCsv,
  serializePositionsCsv,
} from "@/domain/export";
import {
  useExportData,
  useRestoreBackup,
  usePortfolioPosition,
  useUpdateCustomSettings,
  useUserAccess,
  useCategories,
  useCreditCards,
  useCardPayments,
} from "@/state";

import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export function BackupTab() {
  const visual = useVisualCustomization();
  const { setPreference: setThemePref } = useTheme();
  const { hasFeature } = useUserAccess();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const portfolioPosition = usePortfolioPosition();
  const exportDataQuery = useExportData({ enabled: false });
  const restoreBackupMutation = useRestoreBackup();

  const categoriesQuery = useCategories();
  const creditCardsQuery = useCreditCards();
  const cardPaymentsQuery = useCardPayments();

  const handleExportJson = async (): Promise<void> => {
    const { data: payload } = await exportDataQuery.refetch();
    if (payload) {
      downloadJson(`financas_backup_${todayLocalIso()}.json`, payload);
    }
  };

  const rangeStamp = (range: ExportRange): string =>
    `${range.start.slice(0, 10)}_a_${range.end.slice(0, 10)}`;

  const handleExportCsv = async (kind: ExportCsvKind, range: ExportRange): Promise<void> => {
    const stamp = rangeStamp(range);
    const categories = categoriesQuery.data ?? [];
    const cards = creditCardsQuery.data ?? [];
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const cardName = new Map(cards.map((c) => [c.id, c.name]));

    if (kind === "expenses") {
      const { data: rows } = await exportDataQuery.refetch();
      const expenseRows = (rows?.expenses ?? []).filter(
        (e) => e.date >= range.start && e.date < range.end,
      );
      const csvRows: ExportExpenseRow[] = expenseRows.map((e) => ({
        date: e.date,
        description: e.description ?? "",
        categoryName: categoryName.get(e.category_id) ?? "Sem categoria",
        valueCents: numberToCents(e.value),
        reportValueCents: numberToCents(e.value * (e.report_weight ?? 1)),
        paymentMethodLabel: PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method,
        cardName: e.card_id ? (cardName.get(e.card_id) ?? null) : null,
        installments: (e.installments_total ?? 1) > 1 ? `${e.installment_number}/${e.installments_total}` : "—",
      }));
      downloadCsv(`despesas_${stamp}.csv`, serializeExpensesCsv(csvRows));
      return;
    }

    if (kind === "incomes") {
      const { data: rows } = await exportDataQuery.refetch();
      const incomeRows = (rows?.incomes ?? []).filter(
        (i) => i.date >= range.start && i.date < range.end,
      );
      const csvRows: ExportIncomeRow[] = incomeRows.map((i) => ({
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
      const payments = cardPaymentsQuery.data ?? [];
      const csvRows: ExportInvoiceRow[] = payments
        .filter((p) => p.date >= range.start && p.date < range.end)
        .map((p) => ({
          competenceMonth: p.competence_month,
          cardName: cardName.get(p.card_id) ?? "Cartão removido",
          amountCents: numberToCents(p.amount),
          date: p.date,
          note: p.note,
          isRefund: p.is_refund,
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
  };

  const handleRestoreFile = async (file: File): Promise<RestoreSummary> => {
    const text = await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("Arquivo inválido: não é um JSON válido.");
    }
    const validation = parseBackupPayload(raw);
    if (!validation.ok) {
      throw new Error(validation.errors.join("\n"));
    }
    const summary: RestoreSummary = {};
    for (const key of BACKUP_TABLE_KEYS) {
      summary[key] = validation.payload.data[key].length;
    }
    return summary;
  };

  const handleConfirmRestore = async (file: File): Promise<void> => {
    const text = await file.text();
    const raw: unknown = JSON.parse(text);
    const validation = parseBackupPayload(raw);
    if (!validation.ok) {
      throw new Error(validation.errors.join("\n"));
    }
    await restoreBackupMutation.mutateAsync(validation.payload);
  };

  const handleResetVisuals = () => {
    visual.resetToDefaults();
    setThemePref("system");
    setDensity("comfortable");
    updateCustomSettingsMutation.mutate({
      density: "comfortable",
      surfaceStyle: "glass",
      motionLevel: "fluid",
      soundEnabled: false,
      hapticEnabled: true,
      disabledSensoryIntents: [],
      numberTickerEnabled: true,
      dashboardWidgets: {
        kpis: true,
        summary: true,
        flow: true,
        donut: true,
        budgets: true,
        contextBanners: true,
      },
      headerButtons: {
        logo: true,
        calculatorButton: true,
        themeToggle: false,
        privacyToggle: false,
      },
    });
    triggerSensory("action");
    pushToast({
      title: "Preferências redefinidas",
      description: "Todas as preferências visuais foram restauradas para os padrões.",
      duration: 2500,
    });
  };

  return (
    <div className="space-y-6">
      <ExportDataHub
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        onRestore={handleRestoreFile}
        onConfirmRestore={handleConfirmRestore}
        availableCsvKinds={[
          ...(hasFeature("transactions") ? (["expenses", "incomes"] as const) : []),
          ...(hasFeature("cards") ? (["invoices"] as const) : []),
          ...(hasFeature("investments") ? (["positions"] as const) : []),
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restaurar Padrões Visuais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border bg-surface gap-3">
            <div>
              <div className="font-semibold text-sm text-foreground">Redefinir personalização</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Volta temas, acentos, sons e animações para as configurações padrão de fábrica.
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetVisuals}
              className="gap-2 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-4" />
              <span>Redefinir</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
