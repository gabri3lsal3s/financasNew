/**
 * Script CLI para Execução do Laboratório Forense de Auditoria Sintética e Contínua.
 *
 * Execução: npm run audit:forensics
 *           npx tsx scripts/run-forensics-audit.ts
 */

import fs from "node:fs";
import path from "node:path";
import { runForensicAudit } from "../src/features/admin/forensics/core/runner";
import {
  generateMarkdownDossier,
  generateExcelProofWorkbook,
} from "../src/features/admin/forensics/core/reporters";

async function main() {
  console.log("\n========================================================");
  console.log("   AXIR — LABORATÓRIO FORENSE DE AUDITORIA QUANTITATIVA");
  console.log("========================================================\n");
  console.log("Iniciando auditoria de invariantes matemáticos e contábeis...");

  const report = await runForensicAudit({ environment: "synthetic" });

  console.log(`\nID da Auditoria: ${report.auditId}`);
  console.log(`Ambiente:       ${report.environment}`);
  console.log(`Duração:        ${report.durationMs}ms`);
  console.log(`Asserções:      ${report.totalAssertions} total | ${report.totalPassed} aprovadas | ${report.totalFailed} falhas`);
  console.log(`Score Global:   ${report.overallScore}%\n`);

  console.log("--------------------------------------------------------");
  console.log("SCORECARD POR MÓDULO DE NEGÓCIO:");
  console.log("--------------------------------------------------------");
  for (const mod of Object.values(report.moduleScores)) {
    const statusText = mod.failed === 0 ? "APROVADO" : "FALHA";
    console.log(
      `  • ${mod.label.padEnd(38, " ")} | ${String(mod.score).padStart(3, " ")}% | ${mod.passed}/${mod.total} | ${statusText}`,
    );
  }

  // Gera artefatos em reports/
  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 1. Dossiê Markdown
  const dossierPath = path.join(reportsDir, "forensics-audit-dossier.md");
  const dossierContent = generateMarkdownDossier(report);
  fs.writeFileSync(dossierPath, dossierContent, "utf-8");
  console.log(`\nDossiê Markdown gerado em: ${dossierPath}`);

  // 2. Planilha de Contra-Prova Excel (SpreadsheetML)
  const excelPath = path.join(reportsDir, "forensics-contra-prova.xls");
  const excelContent = generateExcelProofWorkbook(report);
  fs.writeFileSync(excelPath, excelContent, "utf-8");
  console.log(`Planilha de Contra-Prova Excel gerada em: ${excelPath}`);
  console.log("========================================================\n");

  if (report.totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Falha catastrófica ao executar auditoria forense:", err);
  process.exit(1);
});
