import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button, Checkbox, Select } from "@/components/ui";
import type { ColumnMapping, RawParsedRow } from "@/domain/reconciliation";

interface BankStatementMappingStepProps {
  rows: RawParsedRow[];
  initialMapping: ColumnMapping;
  onConfirmMapping: (mapping: ColumnMapping) => void;
  onBack: () => void;
}

/**
 * Passo 2 do Diálogo de Importação de Extrato Bancário:
 * Exibe a prévia das 5 primeiras linhas interpretadas e permite
 * ajustar as colunas de Data, Descrição, Valor e Tipo (D/C).
 */
export function BankStatementMappingStep({
  rows,
  initialMapping,
  onConfirmMapping,
  onBack,
}: BankStatementMappingStepProps) {
  const [dateCol, setDateCol] = useState(initialMapping.dateColIndex.toString());
  const [descCol, setDescCol] = useState(initialMapping.descriptionColIndex.toString());
  const [amountCol, setAmountCol] = useState(initialMapping.amountColIndex.toString());
  const [typeCol, setTypeCol] = useState(
    initialMapping.typeColIndex !== undefined ? initialMapping.typeColIndex.toString() : "none",
  );
  const [hasHeader, setHasHeader] = useState(initialMapping.hasHeader);

  const previewRows = rows.slice(0, 5);
  const maxCols = Math.max(...previewRows.map((r) => r.cells.length), 3);

  const columnOptions = Array.from({ length: maxCols }, (_, i) => ({
    value: i.toString(),
    label: `Coluna ${i + 1}`,
  }));

  const typeColumnOptions = [
    { value: "none", label: "Nenhuma (detectar por sinal +/-)" },
    ...columnOptions,
  ];

  const handleApply = () => {
    onConfirmMapping({
      dateColIndex: Number.parseInt(dateCol, 10),
      descriptionColIndex: Number.parseInt(descCol, 10),
      amountColIndex: Number.parseInt(amountCol, 10),
      typeColIndex: typeCol !== "none" ? Number.parseInt(typeCol, 10) : undefined,
      hasHeader,
      startRowIndex: hasHeader ? 1 : 0,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-surface/50 p-3">
        <p className="text-xs font-medium text-foreground mb-2">Prévia das primeiras linhas do extrato bancário:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground">
                <th className="py-1 px-2">#</th>
                {Array.from({ length: maxCols }).map((_, c) => (
                  <th key={c} className="py-1 px-2">
                    Col {c + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {previewRows.map((row, idx) => (
                <tr
                  key={row.rowIndex}
                  className={idx === 0 && hasHeader ? "opacity-50 italic bg-muted/10" : "hover:bg-muted/10"}
                >
                  <td className="py-1 px-2 text-muted-foreground font-mono">{idx + 1}</td>
                  {Array.from({ length: maxCols }).map((_, c) => (
                    <td key={c} className="py-1 px-2 truncate max-w-[140px] font-mono text-[11px]">
                      {row.cells[c] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium text-foreground">Coluna de Data</span>
          <Select
            value={dateCol}
            onValueChange={setDateCol}
            options={columnOptions}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-foreground">Coluna de Descrição</span>
          <Select
            value={descCol}
            onValueChange={setDescCol}
            options={columnOptions}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-foreground">Coluna de Valor</span>
          <Select
            value={amountCol}
            onValueChange={setAmountCol}
            options={columnOptions}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-foreground">Tipo Débito/Crédito</span>
          <Select
            value={typeCol}
            onValueChange={setTypeCol}
            options={typeColumnOptions}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
        <Checkbox
          checked={hasHeader}
          onCheckedChange={setHasHeader}
          label="Primeira linha é cabeçalho (ignorar)"
        />

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="gap-1.5"
          >
            <RotateCcw className="size-4" aria-hidden />
            Voltar
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            className="gap-1.5"
          >
            Avançar para Conferência
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
