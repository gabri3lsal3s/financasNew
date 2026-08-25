import { FileSpreadsheet, Landmark, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { ExcelExportCard } from "@/features/reports/components/excel-export-card";
import type { ExcelWorkbookData } from "@/services/excel-export";

export interface TaxTabProps {
  workbookData: ExcelWorkbookData;
  excelDescription: string;
  onOpenTaxReport: () => void;
  onOpenDarfMonitor: () => void;
}

/**
 * Aba "Fiscal & Declaração" — Facilitador de IRPF, Monitor DARF e Exportação Excel.
 */
export function TaxTab({
  workbookData,
  excelDescription,
  onOpenTaxReport,
  onOpenDarfMonitor,
}: TaxTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Card 1: Facilitador de Declaração de IRPF */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">Facilitador de Declaração de IRPF</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Textos prontos com 1-clique para cópia das Fichas de Bens e Direitos e Rendimentos Isentos/Exclusivos para o programa da Receita Federal.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          onClick={onOpenTaxReport}
          className="gap-2 shrink-0 w-full sm:w-auto justify-center"
        >
          <Printer className="size-4" aria-hidden="true" />
          Abrir Fichas de IRPF
        </Button>
      </div>

      {/* Card 2: Monitor Mensal de DARF & Isenção de R$ 20k */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-warning-strong shrink-0" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">Monitor Mensal de DARF & Isenção de R$ 20k</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Apuração de operações de venda em bolsa de valores, controle da faixa de isenção mensal de R$ 20.000 para ações e cálculo de imposto a recolher.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          onClick={onOpenDarfMonitor}
          className="gap-2 shrink-0 w-full sm:w-auto justify-center"
        >
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          Abrir Monitor DARF
        </Button>
      </div>

      {/* Card 3: Caderno de Relatórios em Excel (.xlsx) */}
      <ExcelExportCard workbookData={workbookData} description={excelDescription} />
    </div>
  );
}
