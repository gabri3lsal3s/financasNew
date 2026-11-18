import { Download, FileSpreadsheet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioGroup } from "@/components/ui/radio-group";
import { MonthPicker } from "@/components/modules/month-picker";

export type ExportCsvKind = "expenses" | "incomes" | "invoices" | "positions";

/** Período de exportação — `end` exclusivo (range [start, end)). */
export interface ExportRange {
  start: string;
  end: string;
}

export interface CsvExportCardProps {
  periodMode: "month" | "custom";
  onPeriodModeChange: (mode: "month" | "custom") => void;
  month: string;
  onMonthChange: (month: string) => void;
  customStart: string;
  onCustomStartChange: (date: string) => void;
  customEnd: string;
  onCustomEndChange: (date: string) => void;
  periodValid: boolean;
  busy: boolean;
  csvBusy: ExportCsvKind | null;
  csvError: string | null;
  actions: readonly { kind: ExportCsvKind; label: string }[];
  onExportCsv: (kind: ExportCsvKind) => void;
  description?: string;
}

/** Card reutilizável de exportação de Extratos CSV por mês ou intervalo customizado. */
export function CsvExportCard({
  periodMode,
  onPeriodModeChange,
  month,
  onMonthChange,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
  periodValid,
  busy,
  csvBusy,
  csvError,
  actions,
  onExportCsv,
  description,
}: CsvExportCardProps) {
  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Extratos CSV</span>
        </CardTitle>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={periodMode}
          onValueChange={(value) => onPeriodModeChange(value as "month" | "custom")}
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
              <span className="text-xs font-semibold text-foreground">Mês</span>
              <MonthPicker value={month} onValueChange={onMonthChange} disabled={busy} />
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">De</span>
                <DatePicker value={customStart} onValueChange={onCustomStartChange} ariaLabel="Data inicial" disabled={busy} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Até</span>
                <DatePicker value={customEnd} onValueChange={onCustomEndChange} ariaLabel="Data final" disabled={busy} />
              </div>
            </div>
          )}
          {!periodValid ? (
            <p role="alert" className="text-xs font-medium text-critical-strong">
              Informe um intervalo válido (início antes ou igual ao fim).
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map(({ kind, label }) => (
            <Button
              key={kind}
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent={false}
              loading={csvBusy === kind}
              disabled={!periodValid || (busy && csvBusy !== kind)}
              onClick={() => onExportCsv(kind)}
              className="justify-start gap-2"
            >
              <Download className="size-4" aria-hidden="true" />
              <span>CSV de {label}</span>
            </Button>
          ))}
        </div>

        {csvError && <Alert variant="error">{csvError}</Alert>}
      </CardContent>
    </Card>
  );
}
