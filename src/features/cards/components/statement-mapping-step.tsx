import { useId, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button, Checkbox, FormField, ModalFooter, Select } from "@/components/ui";
import type { ColumnMapping, RawParsedRow } from "@/domain/reconciliation";

export interface StatementMappingStepProps {
  rows: RawParsedRow[];
  initialMapping: ColumnMapping;
  onConfirmMapping: (mapping: ColumnMapping) => void;
  onBack: () => void;
  /** Quando definido, vincula a submissão ao `<Modal footer>` do diálogo pai. */
  formId?: string;
  /** Suprime o rodapé interno quando o diálogo pai renderiza os botões no `Modal.footer`. */
  hideFooter?: boolean;
}

/**
 * Passo 2 do Diálogo de Importação de Fatura:
 * Exibe a prévia das 5 primeiras linhas interpretadas e permite
 * ao usuário ajustar manualmente as colunas de Data, Descrição e Valor.
 */
export function StatementMappingStep({
  rows,
  initialMapping,
  onConfirmMapping,
  onBack,
  formId: externalFormId,
  hideFooter = false,
}: StatementMappingStepProps) {
  const generatedId = useId();
  const formId = externalFormId ?? generatedId;
  const [dateCol, setDateCol] = useState(initialMapping.dateColIndex.toString());
  const [descCol, setDescCol] = useState(initialMapping.descriptionColIndex.toString());
  const [amountCol, setAmountCol] = useState(initialMapping.amountColIndex.toString());
  const [hasHeader, setHasHeader] = useState(initialMapping.hasHeader);

  const previewRows = rows.slice(0, 5);
  const maxCols = Math.max(...previewRows.map((r) => r.cells.length), 3);

  const headerCells = hasHeader && rows.length > 0 ? rows[0]?.cells ?? [] : [];
  const columnOptions = Array.from({ length: maxCols }, (_, i) => {
    const rawHeader = headerCells[i]?.trim();
    const headerSuffix = rawHeader ? ` (${rawHeader})` : "";
    return {
      value: i.toString(),
      label: `Coluna ${i + 1}${headerSuffix}`,
    };
  });

  const handleApply = () => {
    onConfirmMapping({
      dateColIndex: Number.parseInt(dateCol, 10),
      descriptionColIndex: Number.parseInt(descCol, 10),
      amountColIndex: Number.parseInt(amountCol, 10),
      hasHeader,
      startRowIndex: hasHeader ? 1 : 0,
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
      <div className="rounded-xl border border-border/80 bg-surface-raised p-3">
        <p className="text-xs font-semibold text-foreground mb-2">
          Prévia das primeiras linhas do extrato:
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
            <tbody className="divide-y divide-border/60">
              {previewRows.map((row, idx) => (
                <tr
                  key={row.rowIndex}
                  className={
                    idx === 0 && hasHeader ? "opacity-50 italic bg-muted/20" : "hover:bg-surface-hover/50"
                  }
                >
                  <td className="py-1.5 px-2 text-muted-foreground font-mono">{idx + 1}</td>
                  {Array.from({ length: maxCols }).map((_, c) => (
                    <td key={c} className="py-1.5 px-2 truncate max-w-[140px] font-mono text-[11px]">
                      {row.cells[c] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <FormField label="Coluna de Data">
          <Select value={dateCol} onValueChange={setDateCol} options={columnOptions} ariaLabel="Coluna de Data" />
        </FormField>
        <FormField label="Coluna de Descrição">
          <Select value={descCol} onValueChange={setDescCol} options={columnOptions} ariaLabel="Coluna de Descrição" />
        </FormField>
        <FormField label="Coluna de Valor">
          <Select value={amountCol} onValueChange={setAmountCol} options={columnOptions} ariaLabel="Coluna de Valor" />
        </FormField>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface-raised p-3">
        <Checkbox
          checked={hasHeader}
          onCheckedChange={setHasHeader}
          label="Primeira linha é cabeçalho (ignorar)"
        />
      </div>

      {!hideFooter ? (
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={onBack} className="gap-1.5">
            <RotateCcw className="size-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button type="submit" className="gap-1.5">
            Avançar para Conferência
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </ModalFooter>
      ) : null}
    </form>
  );
}
