/**
 * Painel de Artefatos & Exportação Forense (forensics-artifacts-panel.tsx).
 *
 * Provê download direto no navegador dos dois artefatos da auditoria:
 * 1. Dossiê Executivo Estruturado (.md)
 * 2. Caderno Excel de Contra-Prova com Fórmulas Nativas (.xls SpreadsheetML)
 */

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { downloadTextFile } from "@/services/export-actions";
import {
  generateMarkdownDossier,
  generateExcelProofWorkbook,
} from "../core/reporters";
import type { ForensicAuditReport } from "../core/types";

interface ForensicsArtifactsPanelProps {
  report: ForensicAuditReport;
}

export function ForensicsArtifactsPanel({ report }: ForensicsArtifactsPanelProps) {
  const handleDownloadMarkdown = () => {
    const mdContent = generateMarkdownDossier(report);
    void downloadTextFile(`dossie-forense-${report.auditId}.md`, mdContent, "text/markdown;charset=utf-8");
  };

  const handleDownloadExcel = () => {
    const excelContent = generateExcelProofWorkbook(report);
    void downloadTextFile(
      `contra-prova-forense-${report.auditId}.xls`,
      excelContent,
      "application/vnd.ms-excel;charset=utf-8",
    );
  };

  return (
    <Card className="border-border/80 bg-surface shadow-xs w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-foreground">
          Artefatos Forenses de Contra-Prova
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Baixe os relatórios certificados para validação em editores de código e planilhas eletrônicas.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card Markdown */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-surface flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong shrink-0">
                <FileText className="size-4.5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">
                  Dossiê Executivo Markdown
                </span>
                <span className="text-[11px] text-muted-foreground leading-relaxed">
                  Relatório completo contendo scorecard de módulos, tabela de divergências e detalhes das personas.
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadMarkdown}
              className="gap-2 text-xs cursor-pointer w-full"
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span>Baixar Dossiê (.md)</span>
            </Button>
          </div>

          {/* Card Excel */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-surface flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-positive/10 border border-positive/20 text-positive-strong shrink-0">
                <FileSpreadsheet className="size-4.5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">
                  Caderno de Contra-Prova Excel
                </span>
                <span className="text-[11px] text-muted-foreground leading-relaxed">
                  5 abas consolidadas com fórmulas nativas do Excel (=SUM, =ABS, R1C1) e alerta visual de delta &gt; 0,01.
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              className="gap-2 text-xs cursor-pointer w-full"
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span>Baixar Contra-Prova (.xls)</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
