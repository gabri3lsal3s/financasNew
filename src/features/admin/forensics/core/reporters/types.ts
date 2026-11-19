/**
 * Contratos dos Geradores de Relatório Forense (Markdown e Excel).
 */

import type { ForensicAuditReport } from "../types";

export interface ForensicReportGenerator {
  generateMarkdownDossier: (report: ForensicAuditReport) => string;
  generateExcelProofWorkbook: (report: ForensicAuditReport) => string; // Retorna XML SpreadsheetML compatível
}
