import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui";
import { todayISO } from "@/domain/debts";
import { exportMultiSheetExcel, type ExcelWorkbookData } from "@/services/excel-export";
import { pushToast } from "@/services/toast";

export interface ExcelExportCardProps {
  workbookData: ExcelWorkbookData;
  description?: string;
}

export function ExcelExportCard({
  workbookData,
  description = "Exportação completa em 5 abas (Resumo Patrimonial, Custódia de Ativos, Proventos, DRE e Dívidas) com formatações e fórmulas nativas.",
}: ExcelExportCardProps) {
  const [downloading, setDownloading] = useState(false);

  const handleExport = () => {
    setDownloading(true);
    try {
      const today = todayISO();
      exportMultiSheetExcel(`Caderno_Relatorios_Financeiro_${today}`, workbookData);
      pushToast({
        title: "Download iniciado",
        description: "O Caderno Excel Multi-Abas foi gerado com sucesso.",
        variant: "success",
      });
    } catch {
      pushToast({
        title: "Erro na exportação",
        description: "Não foi possível gerar a planilha Excel no momento.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-portfolio/30 bg-portfolio/5 p-4 sm:p-5 shadow-xs">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-portfolio/10 border border-portfolio/20 text-portfolio mt-0.5 sm:mt-0">
          <FileSpreadsheet className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-foreground">Caderno de Relatórios em Excel (.xlsx)</h2>
            <span className="rounded-md bg-portfolio/15 px-2 py-0.5 text-[10px] font-bold text-portfolio uppercase tracking-wide">
              Multi-Abas
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="default"
        size="default"
        onClick={handleExport}
        disabled={downloading}
        className="gap-2 shrink-0 w-full sm:w-auto justify-center"
      >
        <Download className="size-4" aria-hidden="true" />
        {downloading ? "Gerando planilha..." : "Baixar Caderno Excel"}
      </Button>
    </div>
  );
}
