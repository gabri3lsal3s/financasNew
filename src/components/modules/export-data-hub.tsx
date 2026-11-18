import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { addDaysISO } from "@/domain/debts";
import type { RestoreSummary } from "@/domain/export";
import { currentMonth, monthRange } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { authenticateWithBiometrics, isNativePlatform } from "@/services/native";
import { triggerSensory } from "@/services/sensory";
import {
  CsvExportCard,
  type CsvExportCardProps,
  type ExportCsvKind,
  type ExportRange,
} from "./reports/csv-export-card";
import {
  EXPORT_CSV_ACTIONS,
  formatRestoreSummaryEntries,
} from "./reports/export-hub-constants";
import { JsonBackupCard, type RestoreStep } from "./reports/json-backup-card";

export { CsvExportCard };
export type { CsvExportCardProps, ExportCsvKind, ExportRange };

export interface ExportDataHubProps {
  /** Gera e baixa o backup JSON completo. */
  onExportJson?: () => Promise<void>;
  /** Gera e baixa o CSV do tipo solicitado no período. */
  onExportCsv: (kind: ExportCsvKind, range: ExportRange) => Promise<void>;
  /** Valida o arquivo e devolve o resumo; lança erro pt-BR se inválido. */
  onRestore?: (file: File) => Promise<RestoreSummary>;
  /** Executa a restauração (2ª etapa, após confirmação). */
  onConfirmRestore?: (file: File) => Promise<void>;
  /** Abre o assistente interativo de restauração com desduplicação. */
  onOpenRestoreWizard?: () => void;
  /** Tipos de CSV disponíveis para exportação de acordo com os módulos permitidos. */
  availableCsvKinds?: ExportCsvKind[];
  /** Exibe exclusivamente o painel de Extratos CSV, ocultando o bloco de backup/restore JSON. */
  csvOnly?: boolean;
}

/** Hub de Exportação e Dados (F22) — composição 100% presentacional. */
export function ExportDataHub({
  onExportJson,
  onExportCsv,
  onRestore,
  onConfirmRestore,
  onOpenRestoreWizard,
  availableCsvKinds,
  csvOnly = false,
}: ExportDataHubProps) {
  const [exportingJson, setExportingJson] = useState(false);
  const [csvBusy, setCsvBusy] = useState<ExportCsvKind | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<"month" | "custom">("month");
  const [month, setMonth] = useState(currentMonth());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [restore, setRestore] = useState<RestoreStep>({ step: "idle" });
  const [showConfirmJsonExport, setShowConfirmJsonExport] = useState(false);

  const periodValid =
    periodMode === "month" ||
    (customStart.length === 10 && customEnd.length === 10 && customStart <= customEnd);

  const getRange = (): ExportRange =>
    periodMode === "month" ? monthRange(month) : { start: customStart, end: addDaysISO(customEnd, 1) };

  const executeExportJson = async () => {
    if (!onExportJson) return;
    setExportingJson(true);
    setJsonError(null);
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

  const handleExportJsonClick = async () => {
    if (busy) return;
    setJsonError(null);

    if (isNativePlatform()) {
      const auth = await authenticateWithBiometrics(
        "Confirme sua identidade para exportar seus dados financeiros",
      );
      if (!auth.success) {
        if (auth.error) setJsonError(auth.error);
        return;
      }
      await executeExportJson();
    } else {
      setShowConfirmJsonExport(true);
    }
  };

  const handleExportCsv = async (kind: ExportCsvKind) => {
    if (!periodValid) return;
    setCsvBusy(kind);
    setCsvError(null);
    try {
      await onExportCsv(kind, getRange());
      triggerSensory("success");
    } catch (error) {
      triggerSensory("error");
      setCsvError(getErrorMessage(error));
    } finally {
      setCsvBusy(null);
    }
  };

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || !onRestore) return;
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
    if (restore.step !== "preview" || !onConfirmRestore) return;
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

  const previewSummary = restore.step === "preview" ? restore.summary : null;
  const renderedCsvActions = availableCsvKinds
    ? EXPORT_CSV_ACTIONS.filter((action) => availableCsvKinds.includes(action.kind))
    : EXPORT_CSV_ACTIONS;

  const csvCardProps: CsvExportCardProps = {
    periodMode,
    onPeriodModeChange: setPeriodMode,
    month,
    onMonthChange: setMonth,
    customStart,
    onCustomStartChange: setCustomStart,
    customEnd,
    onCustomEndChange: setCustomEnd,
    periodValid,
    busy,
    csvBusy,
    csvError,
    actions: renderedCsvActions,
    onExportCsv: (kind) => void handleExportCsv(kind),
  };

  if (csvOnly) {
    return (
      <CsvExportCard
        {...csvCardProps}
        description="Exporte relatórios financeiros estruturados por mês ou período customizado para planilhas."
      />
    );
  }

  return (
    <div className="space-y-6">
      <JsonBackupCard
        exportingJson={exportingJson}
        busy={busy}
        jsonError={jsonError}
        restore={restore}
        onExportJsonClick={() => void handleExportJsonClick()}
        onFiles={(files) => void handleFiles(files)}
        onResetRestore={() => setRestore({ step: "idle" })}
        onOpenRestoreWizard={onOpenRestoreWizard}
      />

      <CsvExportCard {...csvCardProps} />

      <ConfirmDialog
        open={showConfirmJsonExport}
        onOpenChange={setShowConfirmJsonExport}
        title="Confirmar download do backup"
        description="O arquivo JSON exportado conterá todo o seu histórico financeiro, transações, contas e cartões em texto legível. Certifique-se de salvá-lo em um local seguro."
        confirmLabel="Exportar backup"
        cancelLabel="Cancelar"
        confirmPending={exportingJson}
        onConfirm={() => {
          setShowConfirmJsonExport(false);
          void executeExportJson();
        }}
      />

      {previewSummary && (
        <ConfirmDialog
          open={restore.step === "preview"}
          onOpenChange={(open) => {
            if (!open && restore.step === "preview") setRestore({ step: "idle" });
          }}
          title="Resumo do backup"
          description="Esta ação substituirá todos os seus dados atuais pelo conteúdo do backup. Verifique a contagem de registros:"
          confirmLabel="Restaurar backup"
          cancelLabel="Cancelar"
          variant="destructive"
          onConfirm={handleConfirmRestore}
        >
          <div className="mt-2 space-y-1 text-xs">
            {formatRestoreSummaryEntries(previewSummary).map(([label, count]) => (
              <div key={label} className="flex justify-between py-0.5 text-muted-foreground">
                <span>{label}</span>
                <span className="font-mono tabular-nums text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
