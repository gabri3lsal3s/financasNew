import { useState } from "react";
import { Database, Download, FileJson, FileSpreadsheet, RefreshCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropzone } from "@/components/ui/dropzone";
import { RadioGroup } from "@/components/ui/radio-group";
import { MonthPicker } from "@/components/modules/month-picker";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { currentMonth, monthRange } from "@/lib/date";
import { addDaysISO } from "@/domain/debts";
import type { RestoreSummary } from "@/domain/export";

export type ExportCsvKind = "expenses" | "incomes" | "invoices" | "positions";

/** Período de exportação — `end` exclusivo (range [start, end)). */
export interface ExportRange {
  start: string;
  end: string;
}

export interface ExportDataHubProps {
  /** Gera e baixa o backup JSON completo. */
  onExportJson: () => Promise<void>;
  /** Gera e baixa o CSV do tipo solicitado no período. */
  onExportCsv: (kind: ExportCsvKind, range: ExportRange) => Promise<void>;
  /** Valida o arquivo e devolve o resumo; lança erro pt-BR se inválido. */
  onRestore: (file: File) => Promise<RestoreSummary>;
  /** Executa a restauração (2ª etapa, após confirmação). */
  onConfirmRestore: (file: File) => Promise<void>;
}

type RestoreStep =
  | { step: "idle" }
  | { step: "validating" }
  | { step: "preview"; file: File; summary: RestoreSummary }
  | { step: "restoring"; file: File; summary: RestoreSummary }
  | { step: "done"; summary: RestoreSummary }
  | { step: "error"; message: string };

const CSV_ACTIONS: { kind: ExportCsvKind; label: string }[] = [
  { kind: "expenses", label: "Despesas" },
  { kind: "incomes", label: "Receitas" },
  { kind: "invoices", label: "Faturas de cartão" },
  { kind: "positions", label: "Posições da carteira" },
];

const SUMMARY_LABELS: Record<string, string> = {
  categories: "Categorias",
  credit_cards: "Cartões",
  incomes: "Receitas",
  expenses: "Despesas",
  card_payments: "Pagamentos de fatura",
  debts: "Dívidas",
  budgets: "Orçamentos",
  income_goals: "Metas de renda",
  insight_feedback: "Feedback de insights",
  reminder_states: "Lembretes",
  portfolio_assets: "Ativos",
  portfolio_transactions: "Lançamentos de ativos",
  allocation_targets: "Metas de alocação",
  asset_prices: "Cotações manuais",
  user_preferences: "Preferências",
};

/** Hub de Exportação e Dados (F22) — composição 100% presentacional. */
export function ExportDataHub({ onExportJson, onExportCsv, onRestore, onConfirmRestore }: ExportDataHubProps) {
  const [exportingJson, setExportingJson] = useState(false);
  const [csvBusy, setCsvBusy] = useState<ExportCsvKind | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<"month" | "custom">("month");
  const [month, setMonth] = useState(currentMonth());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [restore, setRestore] = useState<RestoreStep>({ step: "idle" });

  const periodValid =
    periodMode === "month" ||
    (customStart !== "" && customEnd !== "" && customStart <= customEnd);

  const resolveRange = (): ExportRange =>
    periodMode === "month"
      ? monthRange(month)
      : { start: customStart, end: customEnd ? addDaysISO(customEnd, 1) : "" };

  const handleExportJson = async (): Promise<void> => {
    setJsonError(null);
    setExportingJson(true);
    try {
      await onExportJson();
      triggerSensory("success");
    } catch (error) {
      triggerSensory("error");
      setJsonError(getErrorMessage(error));
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportCsv = async (kind: ExportCsvKind): Promise<void> => {
    if (csvBusy !== null || !periodValid) return;
    setCsvError(null);
    setCsvBusy(kind);
    try {
      await onExportCsv(kind, resolveRange());
      triggerSensory("success");
    } catch (error) {
      triggerSensory("error");
      setCsvError(getErrorMessage(error));
    } finally {
      setCsvBusy(null);
    }
  };

  const handleFiles = async (files: File[]): Promise<void> => {
    const file = files[0];
    if (!file) return;
    setRestore({ step: "validating" });
    try {
      const summary = await onRestore(file);
      setRestore({ step: "preview", file, summary });
    } catch (error) {
      triggerSensory("error");
      setRestore({ step: "error", message: getErrorMessage(error) });
    }
  };

  const handleConfirmRestore = async (): Promise<void> => {
    if (restore.step !== "preview") return;
    const { file, summary } = restore;
    setRestore({ step: "restoring", file, summary });
    try {
      await onConfirmRestore(file);
      triggerSensory("success");
      setRestore({ step: "done", summary });
    } catch (error) {
      triggerSensory("error");
      setRestore({ step: "error", message: getErrorMessage(error) });
    }
  };

  const busy =
    exportingJson ||
    csvBusy !== null ||
    restore.step === "validating" ||
    restore.step === "restoring";

  const summaryEntries = (summary: RestoreSummary): [string, number][] =>
    Object.entries(summary)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => [SUMMARY_LABELS[key] ?? key, count]);

  const previewSummary = restore.step === "preview" ? restore.summary : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <Database className="size-4 inline-block mr-2 -mt-0.5 text-muted-foreground" aria-hidden="true" />
            Backup & Exportação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border bg-surface gap-3">
            <div>
              <div className="font-semibold text-sm text-foreground">Exportar dados completos (JSON)</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Baixe uma cópia estruturada e versionada de todos os seus dados: transações, cartões, dívidas, orçamentos e carteira.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              loading={exportingJson}
              disabled={busy && !exportingJson}
              onClick={handleExportJson}
              className="gap-2 shrink-0"
            >
              <Download className="size-4" aria-hidden="true" />
              <span>Exportar JSON</span>
            </Button>
          </div>

          <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border bg-surface">
            <div>
              <div className="font-semibold text-sm text-foreground">Restaurar backup</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Substitui todos os dados atuais pelo conteúdo do arquivo. Verifique o resumo antes de confirmar.
              </div>
            </div>
            {restore.step === "idle" || restore.step === "validating" ? (
              <Dropzone
                onFiles={handleFiles}
                accept="application/json,.json"
                label="Arraste o arquivo .json aqui ou clique para selecionar"
                hint="Arquivo gerado em Exportar JSON (formato versionado)."
                disabled={busy}
              />
            ) : null}
            {restore.step === "validating" ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCcw className="size-4 animate-spin" aria-hidden="true" />
                Validando integridade do backup...
              </p>
            ) : null}
            {restore.step === "done" ? (
              <Alert variant="success">Backup restaurado com sucesso — os dados foram atualizados.</Alert>
            ) : null}
            {restore.step === "error" ? (
              <Alert variant="error">
                <div className="flex w-full items-start justify-between gap-3">
                  <span className="whitespace-pre-line">{restore.message}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setRestore({ step: "idle" })}>
                    Descartar
                  </Button>
                </div>
              </Alert>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <FileSpreadsheet className="size-4 inline-block mr-2 -mt-0.5 text-muted-foreground" aria-hidden="true" />
            Extratos CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={periodMode}
            onValueChange={(value) => setPeriodMode(value as "month" | "custom")}
            name="periodo-exportacao"
            options={[
              { value: "month", label: "Por mês" },
              { value: "custom", label: "Intervalo customizado" },
            ]}
            className="flex-row gap-4"
          />

          <div className="flex flex-col gap-3">
            {periodMode === "month" ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">Mês</span>
                <MonthPicker value={month} onValueChange={setMonth} disabled={busy} />
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">De</span>
                  <DatePicker value={customStart} onValueChange={setCustomStart} ariaLabel="Data inicial" disabled={busy} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Até</span>
                  <DatePicker value={customEnd} onValueChange={setCustomEnd} ariaLabel="Data final" disabled={busy} />
                </div>
              </div>
            )}
            {!periodValid ? (
              <p className="text-xs text-critical">Informe um intervalo válido (início antes ou igual ao fim).</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CSV_ACTIONS.map(({ kind, label }) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                size="sm"
                loading={csvBusy === kind}
                disabled={!periodValid || (busy && csvBusy !== kind)}
                onClick={() => void handleExportCsv(kind)}
                className="justify-start gap-2"
              >
                <FileJson className="size-4" aria-hidden="true" />
                <span>CSV de {label}</span>
              </Button>
            ))}
          </div>

          {csvError ? <Alert variant="error">{csvError}</Alert> : null}
          {jsonError ? <Alert variant="error">{jsonError}</Alert> : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={previewSummary !== null}
        onOpenChange={(open) => {
          if (!open && previewSummary !== null) setRestore({ step: "idle" });
        }}
        title="Restaurar backup"
        description="Todos os dados atuais serão substituídos pelo conteúdo do arquivo. Esta ação não pode ser desfeita."
        confirmLabel="Restaurar"
        variant="destructive"
        confirmPending={restore.step === "restoring"}
        onConfirm={handleConfirmRestore}
      >
        <div className="rounded-xl border border-border bg-muted/30 p-3.5">
          <div className="text-xs font-medium text-muted-foreground mb-2">Resumo do backup</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {previewSummary !== null
              ? summaryEntries(previewSummary).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground tabular-nums">{count}</span>
                  </div>
                ))
              : null}
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
