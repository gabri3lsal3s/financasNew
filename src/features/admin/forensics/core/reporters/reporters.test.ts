/**
 * Testes do Portão Quatro (Gate 4) — Exportador Duplo de Contra-Prova (Markdown e Excel).
 */

import { describe, it, expect } from "vitest";
import { runForensicAudit } from "../runner";
import { generateMarkdownDossier, generateExcelProofWorkbook } from "./index";

describe("Gate 4 — Exportador Duplo de Contra-Prova (Markdown e Excel com Fórmulas)", () => {
  it("deve gerar o Dossiê Markdown completo com tabela executiva e personas", async () => {
    const report = await runForensicAudit({ environment: "synthetic" });
    const md = generateMarkdownDossier(report);

    expect(md).toContain("# Dossiê Executivo de Auditoria Forense e Contra-Prova");
    expect(md).toContain(report.auditId);
    expect(md).toContain("1. Resumo Executivo por Módulo de Negócio");
    expect(md).toContain("3. Detalhamento de Auditoria por Persona Teórica");
    expect(md).toContain("4. Declaração de Conformidade Quantitativa");

    // Deve cobrir os 10 módulos
    expect(md).toContain("Investimentos & Custódia");
    expect(md).toContain("Inteligência & SmartAdvisor");
    expect(md).toContain("Cartões & Faturas");
    expect(md).toContain("Modo Viagem & Racha");
    expect(md).toContain("Módulos Auxiliares (Pix, Backup, Cripto)");

    // Deve listar todas as 8 personas
    for (const p of report.personas) {
      expect(md).toContain(p.personaName);
      expect(md).toContain(p.personaId);
    }
  });

  it("deve gerar a Planilha Excel SpreadsheetML com 5 abas e fórmulas nativas", async () => {
    const report = await runForensicAudit({ environment: "synthetic" });
    const xml = generateExcelProofWorkbook(report);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"');
    expect(xml.endsWith("</Workbook>")).toBe(true);

    // Deve conter as 5 abas especificadas
    expect(xml).toContain('<Worksheet ss:Name="Resumo Executivo">');
    expect(xml).toContain('<Worksheet ss:Name="Contra-Prova Investimentos">');
    expect(xml).toContain('<Worksheet ss:Name="Contra-Prova Parcelas">');
    expect(xml).toContain('<Worksheet ss:Name="Contra-Prova Racha">');
    expect(xml).toContain('<Worksheet ss:Name="Todas Invariantes">');

    // Deve conter fórmulas nativas do Excel
    expect(xml).toContain('ss:Formula="=RC[-3]*RC[-2]"');
    expect(xml).toContain('ss:Formula="=ABS(RC[-2]-RC[-1])"');
    expect(xml).toContain('ss:Formula="=SUM(R2C:R[-1]C)"');

    // Deve conter estilos de status e delta
    expect(xml).toContain('<Style ss:ID="Header">');
    expect(xml).toContain('<Style ss:ID="DeltaOk">');
    expect(xml).toContain('<Style ss:ID="StatusPass">');
  });
});
