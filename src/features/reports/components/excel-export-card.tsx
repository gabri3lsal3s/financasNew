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
  description = "Exportação completa das abas de Investimentos e Finanças (Resumo Patrimonial, Custódia de Ativos, Proventos e Fiscal) com formatações e fórmulas nativas.",
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-primary-strong shrink-0" aria-hidden="true" />
          <h3 className="text-sm sm:text-base font-bold text-foreground">Caderno de Relatórios em Excel (.xlsx)</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      <Button
        type="button"
        variant="default"
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

