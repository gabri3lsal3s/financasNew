import { useState } from "react";
import { ArrowRight, FileSpreadsheet, History, RotateCcw } from "lucide-react";
import { Badge, Button, Checkbox, FormField, ModalFooter, Select, Tabs } from "@/components/ui";
import type {
  PortfolioColumnMapping,
  PortfolioSpreadsheetMode,
  RawPortfolioRow,
} from "@/domain/portfolio";

interface PortfolioMappingStepProps {
  rows: RawPortfolioRow[];
  initialMapping: PortfolioColumnMapping;
  onConfirmMapping: (mapping: PortfolioColumnMapping) => void;
  onBack: () => void;
}

type ColumnFieldKey = "date" | "ticker" | "type" | "qty" | "price" | "total";

const POSITION_COLUMN_FIELDS: readonly { key: ColumnFieldKey; label: string }[] = [
  { key: "ticker", label: "Coluna de Código / Ticker" },
  { key: "qty", label: "Coluna de Quantidade (Custódia)" },
  { key: "price", label: "Coluna de Preço Médio / Fechamento" },
  { key: "total", label: "Coluna de Valor Total / Atualizado" },
];

const MOVEMENT_COLUMN_FIELDS: readonly { key: ColumnFieldKey; label: string }[] = [
  { key: "date", label: "Coluna de Data" },
  { key: "ticker", label: "Coluna de Código / Ticker" },
  { key: "type", label: "Coluna de Tipo / Movimentação" },
  { key: "qty", label: "Coluna de Quantidade / Cotas" },
  { key: "price", label: "Coluna de Preço Unitário" },
  { key: "total", label: "Coluna de Valor Total" },
];

/**
 * Passo de Mapeamento e Ajuste de Colunas de Planilhas de Investimentos (B3, Corretoras).
 * Suporta planilhas de Posição Atual (Custódia/Fechamento) e de Movimentações (Extrato).
 */
export function PortfolioMappingStep({
  rows,
  initialMapping,
  onConfirmMapping,
  onBack,
}: PortfolioMappingStepProps) {
  const [mode, setMode] = useState<PortfolioSpreadsheetMode>(initialMapping.mode ?? "movements");
  const [cols, setCols] = useState<Record<ColumnFieldKey, string>>(() => ({
    date: initialMapping.dateColIndex.toString(),
    ticker: initialMapping.tickerColIndex.toString(),
    type: initialMapping.typeColIndex.toString(),
    qty: initialMapping.qtyColIndex.toString(),
    price: initialMapping.priceColIndex.toString(),
    total: initialMapping.totalColIndex.toString(),
  }));
  const [hasHeader, setHasHeader] = useState(initialMapping.hasHeader);

  const previewRows = rows.slice(0, 100);
  const maxCols = Math.max(...rows.slice(0, 10).map((r) => r.cells.length), 3);

  const columnOptions = [
    { value: "-1", label: "Nenhuma (Estimar / Opcional)" },
    ...Array.from({ length: maxCols }, (_, i) => {
      const headerName = hasHeader && rows[0]?.cells[i] ? ` — "${rows[0].cells[i]}"` : "";
      return { value: i.toString(), label: `Coluna ${i + 1}${headerName}` };
    }),
  ];

  const getMappedRoleBadge = (colIndex: number) => {
    const roles: string[] = [];
    if (mode === "positions") {
      if (Number.parseInt(cols.ticker, 10) === colIndex) roles.push("Ticker");
      if (Number.parseInt(cols.qty, 10) === colIndex) roles.push("Custódia");
      if (Number.parseInt(cols.price, 10) === colIndex) roles.push("Preço");
      if (Number.parseInt(cols.total, 10) === colIndex) roles.push("Total / Valor");
      if (Number.parseInt(cols.date, 10) === colIndex) roles.push("Data");
    } else {
      if (Number.parseInt(cols.date, 10) === colIndex) roles.push("Data");
      if (Number.parseInt(cols.ticker, 10) === colIndex) roles.push("Ticker");
      if (Number.parseInt(cols.type, 10) === colIndex) roles.push("Operação");
      if (Number.parseInt(cols.qty, 10) === colIndex) roles.push("Qtd");
      if (Number.parseInt(cols.price, 10) === colIndex) roles.push("Preço");
      if (Number.parseInt(cols.total, 10) === colIndex) roles.push("Total");
    }
    if (roles.length === 0) return null;
    return (
      <Badge variant="portfolio" size="xs" className="uppercase font-mono tracking-tight shrink-0">
        {roles.join(" + ")}
      </Badge>
    );
  };

  const handleApply = () => {
    onConfirmMapping({
      mode,
      dateColIndex: Number.parseInt(cols.date, 10),
      tickerColIndex: Number.parseInt(cols.ticker, 10),
      typeColIndex: mode === "movements" ? Number.parseInt(cols.type, 10) : -1,
      qtyColIndex: Number.parseInt(cols.qty, 10),
      priceColIndex: Number.parseInt(cols.price, 10),
      totalColIndex: Number.parseInt(cols.total, 10),
      hasHeader,
      delimiter: initialMapping.delimiter,
    });
  };

  const modeTabs = [
    {
      value: "positions",
      label: "Posição Atual / Custódia",
      icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
    },
    {
      value: "movements",
      label: "Movimentações / Extrato",
      icon: <History className="size-4" aria-hidden="true" />,
    },
  ];

  const activeFields = mode === "positions" ? POSITION_COLUMN_FIELDS : MOVEMENT_COLUMN_FIELDS;

  return (
    <div className="space-y-4 max-w-full min-w-0">
      <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface-raised">
        <span className="text-xs font-semibold text-foreground">Modo de Leitura da Planilha:</span>
        <Tabs
          value={mode}
          onValueChange={(val) => setMode(val as PortfolioSpreadsheetMode)}
          items={modeTabs}
          variant="pills"
          fullWidth
        />
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs max-w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
          <p className="text-xs font-semibold text-foreground">
            Linhas identificadas: {rows.length} {rows.length === 1 ? "linha" : "linhas"} ({maxCols} colunas encontradas)
          </p>
          <span className="text-[11px] text-muted-foreground">
            {rows.length > 100
              ? `Exibindo 100 de ${rows.length} linhas na prévia · Role horizontalmente para inspecionar`
              : "Role horizontalmente para inspecionar todas as colunas"}
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface touch-pan-x w-full">
          <table className="min-w-max w-full text-left text-xs border-collapse">
            <thead className="bg-muted/60">
              <tr className="border-b border-border/80 text-muted-foreground">
                <th className="py-2 px-3 font-mono text-[11px] bg-muted/80 sticky left-0 z-10">#</th>
                {Array.from({ length: maxCols }).map((_, c) => (
                  <th key={c} className="py-2 px-3 font-mono whitespace-nowrap min-w-[140px] align-top">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-foreground">Col {c + 1}</span>
                        {getMappedRoleBadge(c)}
                      </div>
                      {hasHeader && rows[0]?.cells[c] ? (
                        <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[180px]">
                          "{rows[0].cells[c]}"
                        </span>
                      ) : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-surface">
              {previewRows.map((row, idx) => (
                <tr
                  key={row.rowIndex}
                  className={idx === 0 && hasHeader ? "opacity-60 italic bg-muted/30" : "hover:bg-surface-hover/50 transition-colors"}
                >
                  <td className="py-2 px-3 text-muted-foreground font-mono bg-surface sticky left-0 font-medium">
                    {idx + 1}
                  </td>
                  {Array.from({ length: maxCols }).map((_, c) => (
                    <td key={c} className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-foreground/90">
                      {row.cells[c] ? row.cells[c] : <span className="text-muted-foreground/50">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <div
          className={
            mode === "positions"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
          }
        >
          {activeFields.map((field) => (
            <FormField key={field.key} label={field.label} htmlFor={`map-col-${field.key}`}>
              <Select
                id={`map-col-${field.key}`}
                value={cols[field.key]}
                onValueChange={(value) => setCols((prev) => ({ ...prev, [field.key]: value }))}
                options={columnOptions}
                ariaLabel={field.label}
              />
            </FormField>
          ))}
        </div>
        {mode === "positions" ? (
          <p className="text-[11px] text-muted-foreground">
            Dica B3: A Área do Investidor exporta Preço de Fechamento e Valor Atualizado. O app calcula o valor faltante automaticamente se qualquer coluna estiver desmarcada.
          </p>
        ) : null}
      </div>

      <div className="pt-1">
        <Checkbox
          id="hasHeaderInvestments"
          checked={hasHeader}
          onCheckedChange={(checked) => setHasHeader(checked === true)}
          label="A primeira linha do arquivo é um cabeçalho (não importar como lançamento)"
        />
      </div>

      <ModalFooter className="sm:justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Voltar
        </Button>
        <Button type="button" size="sm" onClick={handleApply} className="gap-1.5">
          Avançar para conferência
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Button>
      </ModalFooter>
    </div>
  );
}
