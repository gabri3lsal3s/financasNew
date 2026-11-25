import { useId, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button, Checkbox, FormField, ModalFooter, Select } from "@/components/ui";
import type { ColumnMapping, RawParsedRow } from "@/domain/reconciliation";

export interface StatementMappingFallbackProps {
  rows: RawParsedRow[];
  initialMapping: ColumnMapping;
  onConfirmMapping: (mapping: ColumnMapping) => void;
  onBack: () => void;
  formId?: string;
  hideFooter?: boolean;
}

/**
 * Escape hatch offline exclusivo para CSV/XLSX: ajusta mapeamento de colunas preservando
 * o índice real do cabeçalho quando o arquivo contém preâmbulo (bancos BR).
 */
export function StatementMappingFallback({
  rows,
  initialMapping,
  onConfirmMapping,
  onBack,
  formId: externalFormId,
  hideFooter = false,
}: StatementMappingFallbackProps) {
  const generatedId = useId();
  const formId = externalFormId ?? generatedId;
  const headerRowIndex = initialMapping.hasHeader
    ? Math.max(0, initialMapping.startRowIndex - 1)
    : Math.max(0, initialMapping.startRowIndex);

  const [dateCol, setDateCol] = useState(initialMapping.dateColIndex.toString());
  const [descCol, setDescCol] = useState(initialMapping.descriptionColIndex.toString());
  const [amountCol, setAmountCol] = useState(initialMapping.amountColIndex.toString());
  const [hasHeader, setHasHeader] = useState(initialMapping.hasHeader);

  const previewStart = Math.max(0, headerRowIndex - 1);
  const previewRows = rows.slice(previewStart, previewStart + 6);
  const maxCols = Math.max(...previewRows.map((r) => r.cells.length), 3);

  const headerCells = hasHeader ? rows[headerRowIndex]?.cells ?? [] : [];
  const columnOptions = Array.from({ length: maxCols }, (_, i) => {
    const rawHeader = headerCells[i]?.trim();
    const suffix = rawHeader ? ` (${rawHeader})` : "";
    return { value: i.toString(), label: `Coluna ${i + 1}${suffix}` };
  });

  const handleApply = () => {
    onConfirmMapping({
      dateColIndex: Number.parseInt(dateCol, 10),
      descriptionColIndex: Number.parseInt(descCol, 10),
      amountColIndex: Number.parseInt(amountCol, 10),
      hasHeader,
      startRowIndex: hasHeader ? headerRowIndex + 1 : headerRowIndex,
    });
  };

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        handleApply();
      }}
      className="space-y-4"
    >
      <div className="rounded-xl border border-border/80 bg-surface-raised p-3 shadow-xs">
        <p className="text-xs font-semibold text-foreground mb-2">
          Prévia das primeiras linhas da planilha:
        </p>
        <div className="overflow-x-auto no-scrollbar scroll-smooth">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground">
                <th className="py-1.5 px-2">#</th>
                {Array.from({ length: maxCols }).map((_, c) => (
                  <th key={c} className="py-1.5 px-2">
                    Col {c + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {previewRows.map((row, idx) => {
                const absIndex = previewStart + idx;
                const isHeaderRow = hasHeader && absIndex === headerRowIndex;
                return (
                  <tr
                    key={row.rowIndex}
                    className={isHeaderRow ? "opacity-55 italic bg-muted/20" : "hover:bg-surface-hover/50"}
                  >
                    <td className="py-1.5 px-2 text-muted-foreground font-mono">
                      {absIndex + 1}
                    </td>
                    {Array.from({ length: maxCols }).map((_, c) => (
                      <td key={c} className="py-1.5 px-2 max-w-[160px] break-words font-mono text-[11px]">
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
        <FormField label="Coluna de valor">
          <Select
            value={amountCol}
            onValueChange={setAmountCol}
            options={columnOptions}
            ariaLabel="Coluna de valor"
          />
        </FormField>
      </div>

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
            Avançar para conferência
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </ModalFooter>
      ) : null}
    </form>
  );
}
