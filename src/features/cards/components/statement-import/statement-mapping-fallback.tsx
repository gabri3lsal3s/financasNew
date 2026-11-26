import { useId, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Badge, Button, Checkbox, FormField, ModalFooter, ResponsiveLabel, Select } from "@/components/ui";
import type {
  ColumnMapping,
  ParsedSpreadsheetSheet,
  RawParsedRow,
} from "@/domain/reconciliation";

type AmountMappingMode = "single" | "debit_credit";

export interface StatementMappingFallbackProps {
  rows: RawParsedRow[];
  initialMapping: ColumnMapping;
  sheets?: readonly ParsedSpreadsheetSheet[];
  activeSheetIndex?: number;
  onSelectSheet?: (sheetIndex: number) => void;
  onConfirmMapping: (mapping: ColumnMapping) => void;
  onBack: () => void;
  formId?: string;
  hideFooter?: boolean;
}

function resolveInitialBoundaryRow(initialMapping: ColumnMapping): number {
  if (initialMapping.headerRowIndex !== undefined) {
    return Math.max(0, initialMapping.headerRowIndex);
  }
  return initialMapping.hasHeader
    ? Math.max(0, initialMapping.startRowIndex - 1)
    : Math.max(0, initialMapping.startRowIndex);
}

/**
 * Escape hatch offline exclusivo para CSV/XLSX: permite trocar aba da planilha,
 * escolher a linha real de cabeçalho/início, colunas de débito/crédito ou tipo D/C.
 */
export function StatementMappingFallback({
  rows,
  initialMapping,
  sheets,
  activeSheetIndex = 0,
  onSelectSheet,
  onConfirmMapping,
  onBack,
  formId: externalFormId,
  hideFooter = false,
}: StatementMappingFallbackProps) {
  const generatedId = useId();
  const formId = externalFormId ?? generatedId;

  const [headerRowIndex, setHeaderRowIndex] = useState(() =>
    resolveInitialBoundaryRow(initialMapping),
  );
  const [dateCol, setDateCol] = useState(initialMapping.dateColIndex.toString());
  const [descCol, setDescCol] = useState(initialMapping.descriptionColIndex.toString());
  const [amountMode, setAmountMode] = useState<AmountMappingMode>(() =>
    initialMapping.debitColIndex !== undefined && initialMapping.creditColIndex !== undefined
      ? "debit_credit"
      : "single",
  );
  const [amountCol, setAmountCol] = useState(initialMapping.amountColIndex.toString());
  const [debitCol, setDebitCol] = useState(
    (initialMapping.debitColIndex ?? initialMapping.amountColIndex).toString(),
  );
  const [creditCol, setCreditCol] = useState(
    (initialMapping.creditColIndex ?? Math.min(initialMapping.amountColIndex + 1, 10)).toString(),
  );
  const [typeCol, setTypeCol] = useState(
    initialMapping.typeColIndex !== undefined ? initialMapping.typeColIndex.toString() : "none",
  );
  const [hasHeader, setHasHeader] = useState(initialMapping.hasHeader);
  const [expandedPreview, setExpandedPreview] = useState(false);

  const currentSyncKey = `${activeSheetIndex}:${rows.length}:${initialMapping.startRowIndex}:${initialMapping.dateColIndex}:${initialMapping.descriptionColIndex}:${initialMapping.amountColIndex}:${initialMapping.debitColIndex ?? ""}-${initialMapping.creditColIndex ?? ""}-${initialMapping.typeColIndex ?? ""}-${initialMapping.hasHeader}`;
  const [prevSyncKey, setPrevSyncKey] = useState(currentSyncKey);
  if (currentSyncKey !== prevSyncKey) {
    setPrevSyncKey(currentSyncKey);
    setHeaderRowIndex(resolveInitialBoundaryRow(initialMapping));
    setDateCol(initialMapping.dateColIndex.toString());
    setDescCol(initialMapping.descriptionColIndex.toString());
    setAmountMode(
      initialMapping.debitColIndex !== undefined && initialMapping.creditColIndex !== undefined
        ? "debit_credit"
        : "single",
    );
    setAmountCol(initialMapping.amountColIndex.toString());
    setDebitCol((initialMapping.debitColIndex ?? initialMapping.amountColIndex).toString());
    setCreditCol(
      (initialMapping.creditColIndex ?? Math.min(initialMapping.amountColIndex + 1, 10)).toString(),
    );
    setTypeCol(
      initialMapping.typeColIndex !== undefined ? initialMapping.typeColIndex.toString() : "none",
    );
    setHasHeader(initialMapping.hasHeader);
  }

  const safeHeaderRow = Math.min(Math.max(0, headerRowIndex), Math.max(0, rows.length - 1));
  const previewStart = expandedPreview ? 0 : Math.max(0, safeHeaderRow - 2);
  const previewLimit = expandedPreview ? 40 : 8;
  const previewRows = rows.slice(previewStart, previewStart + previewLimit);
  const maxCols = Math.max(...rows.slice(0, 40).map((r) => r.cells.length), 3);

  const headerCells = hasHeader ? rows[safeHeaderRow]?.cells ?? [] : [];
  const columnOptions = Array.from({ length: maxCols }, (_, i) => {
    const rawHeader = headerCells[i]?.trim();
    const suffix = rawHeader ? ` (${rawHeader})` : "";
    return { value: i.toString(), label: `Coluna ${i + 1}${suffix}` };
  });

  const typeColumnOptions = [
    { value: "none", label: "Nenhuma (sinal na coluna de valor)" },
    ...columnOptions,
  ];

  const rowSelectorOptions = rows.slice(0, 40).map((row, idx) => {
    const snippet = row.cells.filter((c) => c.trim().length > 0).slice(0, 3).join(" | ").slice(0, 48);
    return {
      value: idx.toString(),
      label: `Linha ${idx + 1}${snippet ? ` — ${snippet}` : ""}`,
    };
  });

  const handleApply = () => {
    const parsedDate = Number.parseInt(dateCol, 10);
    const parsedDesc = Number.parseInt(descCol, 10);
    const parsedAmount = Number.parseInt(amountCol, 10);
    const parsedDebit = Number.parseInt(debitCol, 10);
    const parsedCredit = Number.parseInt(creditCol, 10);
    const parsedType = typeCol !== "none" ? Number.parseInt(typeCol, 10) : undefined;

    onConfirmMapping({
      dateColIndex: parsedDate,
      descriptionColIndex: parsedDesc,
      amountColIndex: amountMode === "debit_credit" ? parsedDebit : parsedAmount,
      ...(amountMode === "debit_credit"
        ? { debitColIndex: parsedDebit, creditColIndex: parsedCredit }
        : {}),
      ...(amountMode === "single" && parsedType !== undefined ? { typeColIndex: parsedType } : {}),
      hasHeader,
      startRowIndex: hasHeader ? safeHeaderRow + 1 : safeHeaderRow,
      ...(hasHeader ? { headerRowIndex: safeHeaderRow } : {}),
    });
  };

  const hasMultipleSheets = Boolean(sheets && sheets.length > 1 && onSelectSheet);

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        handleApply();
      }}
      className="space-y-4"
    >
      {hasMultipleSheets || rowSelectorOptions.length > 1 ? (
        <div
          className={
            hasMultipleSheets && rowSelectorOptions.length > 1
              ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5"
              : "space-y-3"
          }
        >
          {hasMultipleSheets && sheets && onSelectSheet ? (
            <FormField
              label="Aba da planilha"
              helperText="Escolha a aba onde estão os lançamentos da fatura."
            >
              <Select
                value={activeSheetIndex.toString()}
                onValueChange={(val) => {
                  const nextIdx = Number.parseInt(val, 10);
                  if (Number.isFinite(nextIdx) && nextIdx >= 0) {
                    onSelectSheet(nextIdx);
                  }
                }}
                options={[
                  ...(activeSheetIndex < 0
                    ? [{ value: "-1", label: `Todas as abas compatíveis (${rows.length} linhas)` }]
                    : []),
                  ...sheets.map((s, idx) => ({
                    value: idx.toString(),
                    label: `${s.name} (${s.rows.length} linhas)`,
                  })),
                ]}
                ariaLabel="Aba da planilha"
              />
            </FormField>
          ) : null}
          {rowSelectorOptions.length > 1 ? (
            <FormField
              label={hasHeader ? "Linha de cabeçalho" : "Primeira linha de lançamentos"}
              helperText="Clique em uma linha da prévia ou selecione abaixo onde começam os dados."
            >
              <Select
                value={safeHeaderRow.toString()}
                onValueChange={(val) => setHeaderRowIndex(Number.parseInt(val, 10))}
                options={rowSelectorOptions}
                ariaLabel={hasHeader ? "Linha de cabeçalho" : "Primeira linha de lançamentos"}
              />
            </FormField>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-border/80 bg-surface-raised p-3 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">
            Prévia das primeiras linhas da planilha ({rows.length} linhas no total)
          </p>
          {rows.length > 8 ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setExpandedPreview((prev) => !prev)}
              className="gap-1 self-start sm:self-auto"
            >
              {expandedPreview ? (
                <>
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                  Mostrar prévia compacta
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                  Mostrar até {Math.min(rows.length, 40)} linhas
                </>
              )}
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto no-scrollbar scroll-smooth w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground">
                <th className="py-1.5 px-2">#</th>
                {Array.from({ length: maxCols }).map((_, c) => (
                  <th key={c} className="py-1.5 px-2 whitespace-nowrap">
                    Col {c + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {previewRows.map((row, idx) => {
                const absIndex = previewStart + idx;
                const isSelectedBoundary = absIndex === safeHeaderRow;
                const isIgnoredPreamble = absIndex < safeHeaderRow;
                return (
                  <tr
                    key={`${row.rowIndex}-${absIndex}`}
                    onClick={() => setHeaderRowIndex(absIndex)}
                    className={
                      isSelectedBoundary
                        ? "bg-primary/10 font-medium cursor-pointer"
                        : isIgnoredPreamble
                          ? "opacity-45 hover:opacity-80 cursor-pointer"
                          : "hover:bg-surface-hover/50 cursor-pointer"
                    }
                  >
                    <td className="py-1.5 px-2 text-muted-foreground font-mono whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{absIndex + 1}</span>
                        {isSelectedBoundary ? (
                          <Badge size="xs" variant="default">
                            {hasHeader ? "Cabeçalho" : "Início"}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    {Array.from({ length: maxCols }).map((_, c) => (
                      <td
                        key={c}
                        className="py-1.5 px-2 max-w-[160px] break-words font-mono text-[11px]"
                      >
                        {row.cells[c] ?? "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <FormField label="Coluna de data">
          <Select
            value={dateCol}
            onValueChange={setDateCol}
            options={columnOptions}
            ariaLabel="Coluna de data"
          />
        </FormField>
        <FormField label="Coluna de descrição">
          <Select
            value={descCol}
            onValueChange={setDescCol}
            options={columnOptions}
            ariaLabel="Coluna de descrição"
          />
        </FormField>
        <FormField label="Formato da coluna de valor">
          <Select
            value={amountMode}
            onValueChange={(val) => setAmountMode(val as AmountMappingMode)}
            options={[
              { value: "single", label: "Coluna única de valor" },
              { value: "debit_credit", label: "Débito e Crédito separados" },
            ]}
            ariaLabel="Formato da coluna de valor"
          />
        </FormField>
      </div>

      {amountMode === "single" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Coluna de valor">
            <Select
              value={amountCol}
              onValueChange={setAmountCol}
              options={columnOptions}
              ariaLabel="Coluna de valor"
            />
          </FormField>
          <FormField label="Coluna de tipo D/C (opcional)">
            <Select
              value={typeCol}
              onValueChange={setTypeCol}
              options={typeColumnOptions}
              ariaLabel="Coluna de tipo D/C"
            />
          </FormField>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Coluna de débito (compras)">
            <Select
              value={debitCol}
              onValueChange={setDebitCol}
              options={columnOptions}
              ariaLabel="Coluna de débito"
            />
          </FormField>
          <FormField label="Coluna de crédito (estornos)">
            <Select
              value={creditCol}
              onValueChange={setCreditCol}
              options={columnOptions}
              ariaLabel="Coluna de crédito"
            />
          </FormField>
        </div>
      )}

      <div className="rounded-xl border border-border/80 bg-surface-raised p-3">
        <Checkbox
          checked={hasHeader}
          onCheckedChange={setHasHeader}
          label="Ignorar linha de cabeçalho identificada"
        />
      </div>

      {!hideFooter ? (
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={onBack} className="gap-1.5">
            <RotateCcw className="size-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button type="submit" className="gap-1.5">
            <ResponsiveLabel short="Avançar" full="Avançar para conferência" />
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </ModalFooter>
      ) : null}
    </form>
  );
}
