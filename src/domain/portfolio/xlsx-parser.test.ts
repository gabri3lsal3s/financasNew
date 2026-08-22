import { describe, expect, it } from "vitest";
import { parseSharedStringsXml, parseWorksheetXmlToCsv } from "./xlsx-parser";
import { parseInvestmentCsv } from "./import-parser";

describe("domain/portfolio/xlsx-parser — Suporte Nativo a XLSX", () => {
  it("extrai sharedStrings de XML com entidades", () => {
    const xml = `<sst count="3" uniqueCount="3">
      <si><t>Data do Negócio</t></si>
      <si><t>PETR4 &amp; Cia</t></si>
      <si><t>Compra</t></si>
    </sst>`;

    const strings = parseSharedStringsXml(xml);
    expect(strings).toEqual(["Data do Negócio", "PETR4 & Cia", "Compra"]);
  });

  it("converte worksheet XML com referências de strings e valores numéricos em CSV", () => {
    const sharedStrings = ["Data do Negócio", "Código", "Operação", "PETR4", "Compra", "VALE3", "Venda"];
    const sheetXml = `<worksheet>
      <sheetData>
        <row r="1">
          <c r="A1" t="s"><v>0</v></c>
          <c r="B1" t="s"><v>1</v></c>
          <c r="C1" t="s"><v>2</v></c>
          <c r="D1" t="inlineStr"><is><t>Quantidade</t></is></c>
          <c r="E1" t="inlineStr"><is><t>Preço</t></is></c>
          <c r="F1" t="inlineStr"><is><t>Total</t></is></c>
        </row>
        <row r="2">
          <c r="A2" t="inlineStr"><is><t>15/08/2026</t></is></c>
          <c r="B2" t="s"><v>3</v></c>
          <c r="C2" t="s"><v>4</v></c>
          <c r="D2"><v>100</v></c>
          <c r="E2"><v>38.50</v></c>
          <c r="F2"><v>3850</v></c>
        </row>
        <row r="3">
          <c r="A3" t="inlineStr"><is><t>16/08/2026</t></is></c>
          <c r="B3" t="s"><v>5</v></c>
          <c r="C3" t="s"><v>6</v></c>
          <c r="D3"><v>50</v></c>
          <c r="E3"><v>60.00</v></c>
          <c r="F3"><v>3000</v></c>
        </row>
      </sheetData>
    </worksheet>`;

    const csv = parseWorksheetXmlToCsv(sheetXml, sharedStrings);
    expect(csv).toContain("Data do Negócio;Código;Operação;Quantidade;Preço;Total");
    expect(csv).toContain("15/08/2026;PETR4;Compra;100;38.50;3850");

    const rows = parseInvestmentCsv(csv, 2026);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.ticker).toBe("PETR4");
    expect(rows[0]?.type).toBe("buy");
    expect(rows[0]?.quantity).toBe(100);
    expect(rows[0]?.price).toBe(38.5);
    expect(rows[1]?.ticker).toBe("VALE3");
    expect(rows[1]?.type).toBe("sell");
    expect(rows[1]?.quantity).toBe(50);
  });
});
