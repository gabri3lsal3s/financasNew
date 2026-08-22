import { useState } from "react";
import { ArrowRight, FileSpreadsheet, History, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
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

/**
 * Passo de Mapeamento e Ajuste de Colunas de Planilhas de Investimentos (B3, Corretoras).
 * Suporta planilhas de Posição Atual (Custódia/Fechamento) e de Movimentações (Extrato),
 * permitindo desmarcar colunas ausentes para dedução/estimativa automática.
 */
export function PortfolioMappingStep({
  rows,
  initialMapping,
  onConfirmMapping,
  onBack,
}: PortfolioMappingStepProps) {
  const [mode, setMode] = useState<PortfolioSpreadsheetMode>(initialMapping.mode ?? "movements");
  const [dateCol, setDateCol] = useState(initialMapping.dateColIndex.toString());
  const [tickerCol, setTickerCol] = useState(initialMapping.tickerColIndex.toString());
  const [typeCol, setTypeCol] = useState(initialMapping.typeColIndex.toString());
  const [qtyCol, setQtyCol] = useState(initialMapping.qtyColIndex.toString());
  const [priceCol, setPriceCol] = useState(initialMapping.priceColIndex.toString());
  const [totalCol, setTotalCol] = useState(initialMapping.totalColIndex.toString());
  const [hasHeader, setHasHeader] = useState(initialMapping.hasHeader);

  const previewRows = rows.slice(0, 100);
  const maxCols = Math.max(...rows.slice(0, 10).map((r) => r.cells.length), 3);

  const columnOptions = [
    { value: "-1", label: "Nenhuma (Estimar / Opcional)" },
    ...Array.from({ length: maxCols }, (_, i) => {
      const headerName = hasHeader && rows[0]?.cells[i] ? ` — "${rows[0].cells[i]}"` : "";
      return {
        value: i.toString(),
        label: `Coluna ${i + 1}${headerName}`,
      };
    }),
  ];

  const getMappedRoleBadge = (colIndex: number) => {
    const roles: string[] = [];
    if (mode === "positions") {
      if (Number.parseInt(tickerCol, 10) === colIndex) roles.push("Ticker");
      if (Number.parseInt(qtyCol, 10) === colIndex) roles.push("Custódia");
      if (Number.parseInt(priceCol, 10) === colIndex) roles.push("Preço");
      if (Number.parseInt(totalCol, 10) === colIndex) roles.push("Total / Valor");
      if (Number.parseInt(dateCol, 10) === colIndex) roles.push("Data");
    } else {
      if (Number.parseInt(dateCol, 10) === colIndex) roles.push("Data");
      if (Number.parseInt(tickerCol, 10) === colIndex) roles.push("Ticker");
      if (Number.parseInt(typeCol, 10) === colIndex) roles.push("Operação");
      if (Number.parseInt(qtyCol, 10) === colIndex) roles.push("Qtd");
      if (Number.parseInt(priceCol, 10) === colIndex) roles.push("Preço");
      if (Number.parseInt(totalCol, 10) === colIndex) roles.push("Total");
    }
    if (roles.length === 0) return null;
    return (
      <Badge variant="portfolio" className="text-[9px] px-1.5 py-0 uppercase font-mono tracking-tight shrink-0">
        {roles.join(" + ")}
      </Badge>
    );
  };

  const handleApply = () => {
    onConfirmMapping({
      mode,
      dateColIndex: Number.parseInt(dateCol, 10),
      tickerColIndex: Number.parseInt(tickerCol, 10),
      typeColIndex: mode === "movements" ? Number.parseInt(typeCol, 10) : -1,
      qtyColIndex: Number.parseInt(qtyCol, 10),
      priceColIndex: Number.parseInt(priceCol, 10),
      totalColIndex: Number.parseInt(totalCol, 10),
      hasHeader,
      delimiter: initialMapping.delimiter,
    });
  };

  const modeTabs = [
    {
      value: "positions",
      label: "Posição Atual / Custódia",
      icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
      content: null,
    },
    {
      value: "movements",
      label: "Movimentações / Extrato",
      icon: <History className="size-4" aria-hidden="true" />,
      content: null,
    },
  ];

  return (
    <div className="space-y-4 max-w-full min-w-0">
      {/* Seletor de Tipo de Planilha */}
      <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-border/80 bg-surface/50">
        <span className="text-xs font-semibold text-foreground">Modo de Leitura da Planilha:</span>
        <Tabs
          value={mode}
          onValueChange={(val) => setMode(val as PortfolioSpreadsheetMode)}
          items={modeTabs}
          variant="pills"
        />
      </div>

      <div className="rounded-xl border border-border/80 bg-surface/60 p-3.5 max-w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
          <p className="text-xs font-semibold text-foreground">
            Linhas identificadas: {rows.length} {rows.length === 1 ? "linha" : "linhas"} ({maxCols} colunas encontradas)
          </p>
          <span className="text-[11px] text-muted-foreground">
            {rows.length > 100
              ? `Exibindo 100 de ${rows.length} linhas na prévia · Role para inspecionar`
              : "Role horizontalmente e verticalmente para inspecionar todas as colunas e linhas"}
          </span>
        </div>

        {/* Tabela com scroll horizontal e vertical garantidos */}
        <div className="overflow-x-auto overflow-y-auto max-h-56 rounded-lg border border-border/60 bg-surface/80 scrollbar-thin touch-pan-x w-full">
          <table className="min-w-max w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="py-2 px-3 font-mono text-[11px] bg-muted/95 sticky left-0 z-20 shadow-xs">
                  #
                </th>
                {Array.from({ length: maxCols }).map((_, c) => (
                  <th key={c} className="py-2 px-3 font-mono whitespace-nowrap min-w-[140px] align-top">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-foreground">Col {c + 1}</span>
                        {getMappedRoleBadge(c)}
                      </div>
                      {hasHeader && rows[0]?.cells[c] && (
                        <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[180px]">
                          "{rows[0].cells[c]}"
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 bg-surface/40">
              {previewRows.map((row, idx) => (
                <tr
                  key={row.rowIndex}
                  className={idx === 0 && hasHeader ? "opacity-60 italic bg-muted/20" : "hover:bg-muted/15 transition-colors"}
                >
                  <td className="py-2 px-3 text-muted-foreground font-mono bg-surface sticky left-0 z-10 font-medium">
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

      {mode === "positions" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground">Coluna de Código / Ticker</span>
              <Select value={tickerCol} onValueChange={setTickerCol} options={columnOptions} />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground">Coluna de Quantidade (Custódia)</span>
              <Select value={qtyCol} onValueChange={setQtyCol} options={columnOptions} />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground">Coluna de Preço Médio / Fechamento</span>
              <Select value={priceCol} onValueChange={setPriceCol} options={columnOptions} />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-foreground">Coluna de Valor Total / Atualizado</span>
              <Select value={totalCol} onValueChange={setTotalCol} options={columnOptions} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Dica B3: A Área do Investidor exporta Preço de Fechamento e Valor Atualizado. O app calcula o valor faltante automaticamente se qualquer coluna estiver desmarcada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground">Coluna de Data</span>
            <Select value={dateCol} onValueChange={setDateCol} options={columnOptions} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground">Coluna de Código / Ticker</span>
            <Select value={tickerCol} onValueChange={setTickerCol} options={columnOptions} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground">Coluna de Tipo / Movimentação</span>
            <Select value={typeCol} onValueChange={setTypeCol} options={columnOptions} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground">Coluna de Quantidade / Cotas</span>
            <Select value={qtyCol} onValueChange={setQtyCol} options={columnOptions} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground">Coluna de Preço Unitário</span>
            <Select value={priceCol} onValueChange={setPriceCol} options={columnOptions} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-foreground">Coluna de Valor Total</span>
            <Select value={totalCol} onValueChange={setTotalCol} options={columnOptions} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="hasHeaderInvestments"
          checked={hasHeader}
          onCheckedChange={(checked) => setHasHeader(checked === true)}
        />
        <label htmlFor="hasHeaderInvestments" className="text-xs text-foreground cursor-pointer select-none">
          A primeira linha do arquivo é um cabeçalho (não importar como lançamento)
        </label>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/60">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Voltar
        </Button>
        <Button type="button" size="sm" onClick={handleApply} className="gap-1.5">
          Avançar para conferência
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
