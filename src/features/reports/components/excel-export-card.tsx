import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui";
import { todayISO } from "@/domain/debts";
import type { ExcelWorkbookData } from "@/services/excel-export";
import { isNativePlatform } from "@/services/native";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export interface ExcelExportCardProps {
  buildWorkbookData: () => ExcelWorkbookData;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function ExcelExportCard({
  buildWorkbookData,
  description = "Exportação completa das abas de Investimentos e Finanças (Resumo Patrimonial, Custódia de Ativos, Proventos e Fiscal) com formatações e fórmulas nativas.",
  disabled = false,
  disabledReason = "Não há dados para exportar no período selecionado.",
}: ExcelExportCardProps) {
  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    if (disabled) return;
    setDownloading(true);
    try {
      const today = todayISO();
      const { exportMultiSheetExcel } = await import("@/services/excel-export");
      const exported = await exportMultiSheetExcel(`Caderno_Relatorios_Financeiro_${today}`, buildWorkbookData());
      if (!exported) {
        throw new Error("Falha ao exportar planilha.");
      }
      triggerSensory("success");
      const native = isNativePlatform();
      pushToast({
        title: native ? "Planilha exportada" : "Download iniciado",
        description: native
          ? "Salva em Downloads/Axir e pronta para abrir ou compartilhar."
          : "O Caderno Excel Multi-Abas foi gerado com sucesso.",
        variant: "success",
      });
    } catch {
      triggerSensory("error");
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h3 className="text-sm sm:text-base font-bold text-foreground">
            Caderno de Relatórios em Excel (.xlsx)
          </h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>

      <Button
        type="button"
        variant="default"
        sensoryIntent={false}
        onClick={handleExport}
        disabled={downloading || disabled}
        title={disabled ? disabledReason : undefined}
        className="gap-2 shrink-0 w-full sm:w-auto justify-center"
      >
        <Download className="size-4" aria-hidden="true" />
        {downloading ? "Gerando planilha..." : "Baixar Caderno Excel"}
      </Button>
    </div>
  );
}
