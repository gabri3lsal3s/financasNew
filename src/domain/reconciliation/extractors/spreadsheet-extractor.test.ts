import { describe, expect, it } from "vitest";
import {
  normalizeSpreadsheetNumericCellValue,
  parseSpreadsheetOrHtmlToRows,
} from "./spreadsheet-extractor";

function writeUint16LE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeUint32LE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  void writer.write(copy).then(() => writer.close());
  const ab = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(ab);
}

/** Monta um arquivo .xlsx (ZIP) válido em memória para testar descompactação e leitura XML/datas seriais. */
async function buildMinimalXlsxBuffer(files: Record<string, string>): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  let count = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const rawBytes = encoder.encode(content);
    const compressed = await deflateRaw(rawBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20);
    writeUint16LE(localHeader, 8, 8); // deflate
    writeUint32LE(localHeader, 18, compressed.length);
    writeUint32LE(localHeader, 22, rawBytes.length);
    writeUint16LE(localHeader, 26, nameBytes.length);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(centralHeader, 0, 0x02014b50);
    writeUint16LE(centralHeader, 4, 20);
    writeUint16LE(centralHeader, 6, 20);
    writeUint16LE(centralHeader, 10, 8);
    writeUint32LE(centralHeader, 20, compressed.length);
    writeUint32LE(centralHeader, 24, rawBytes.length);
    writeUint16LE(centralHeader, 28, nameBytes.length);
    writeUint32LE(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
    count += 1;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  writeUint32LE(eocd, 0, 0x06054b50);
  writeUint16LE(eocd, 8, count);
  writeUint16LE(eocd, 10, count);
  writeUint32LE(eocd, 12, centralSize);
  writeUint32LE(eocd, 16, offset);

  const totalLen = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out.buffer;
}

describe("spreadsheet-parser (.xlsx, .xls HTML e SpreadsheetML XML — 0 IA)", () => {
  it("converte .xls exportado como tabela HTML bancária (estilo Itaú/Bradesco)", async () => {
    const htmlXls = `
      <html><body><table>
        <tr><th>Data</th><th>Lançamento</th><th>Valor (R$)</th></tr>
        <tr><td>15/08/2026</td><td>SUPERMERCADO ZONA SUL</td><td>235,90</td></tr>
        <tr><td>16/08/2026</td><td>DROGARIA PACHECO</td><td>48,00</td></tr>
      </table></body></html>
    `;

    const rows = await parseSpreadsheetOrHtmlToRows(htmlXls);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.cells).toEqual(["Data", "Lançamento", "Valor (R$)"]);
    expect(rows[1]?.cells).toEqual(["15/08/2026", "SUPERMERCADO ZONA SUL", "235,90"]);
  });

  it("converte .xls em formato SpreadsheetML XML respeitando ss:Index", async () => {
    const xmlXls = `<?xml version="1.0"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Worksheet ss:Name="Fatura"><Table>
          <Row><Cell><Data>10/08/2026</Data></Cell><Cell><Data>POSTO SHELL</Data></Cell><Cell><Data>180,00</Data></Cell></Row>
          <Row><Cell><Data>11/08/2026</Data></Cell><Cell ss:Index="2"><Data>CAFE CENTRAL</Data></Cell><Cell><Data>22,50</Data></Cell></Row>
        </Table></Worksheet>
      </Workbook>`;

    const rows = await parseSpreadsheetOrHtmlToRows(xmlXls);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.cells).toEqual(["10/08/2026", "POSTO SHELL", "180,00"]);
    expect(rows[1]?.cells).toEqual(["11/08/2026", "CAFE CENTRAL", "22,50"]);
  });

  it("descompacta .xlsx real (ZIP + deflate-raw), resolve sharedStrings e converte data serial Excel", async () => {
    // 46249 em serial Excel (base 1899-12-30) = 2026-08-15
    const xlsxBuffer = await buildMinimalXlsxBuffer({
      "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <sst count="4" uniqueCount="4">
          <si><t>Data</t></si>
          <si><t>Estabelecimento</t></si>
          <si><t>Valor</t></si>
          <si><t>Amazon Brasil 02/05</t></si>
        </sst>`,
      "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet>
          <cellXfs count="2">
            <xf numFmtId="0" />
            <xf numFmtId="14" />
          </cellXfs>
        </styleSheet>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet><sheetData>
          <row r="1">
            <c r="A1" t="s"><v>0</v></c>
            <c r="B1" t="s"><v>1</v></c>
            <c r="C1" t="s"><v>2</v></c>
          </row>
          <row r="2">
            <c r="A2" s="1"><v>46249</v></c>
            <c r="B2" t="s"><v>3</v></c>
            <c r="C2"><v>199.90</v></c>
          </row>
        </sheetData></worksheet>`,
    });

    const rows = await parseSpreadsheetOrHtmlToRows(xlsxBuffer);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.cells).toEqual(["Data", "Estabelecimento", "Valor"]);
    expect(rows[1]?.cells).toEqual(["2026-08-15", "Amazon Brasil 02/05", "199.90"]);
  });

  it("rejeita com erro claro planilhas binárias legadas .xls (BIFF8 0xD0, 0xCF, 0x11, 0xE0)", async () => {
    const biff8Buffer = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb2, 0xc3, 0xd4]).buffer;

    await expect(parseSpreadsheetOrHtmlToRows(biff8Buffer)).rejects.toThrow(
      "Planilhas no formato binário legado (.xls / Excel 97-2003) não são suportadas diretamente",
    );
  });

  it("inspeciona múltiplas abas e seleciona automaticamente sheet2.xml quando sheet1.xml é apenas capa/resumo (#20)", async () => {
    const xlsxBuffer = await buildMinimalXlsxBuffer({
      "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <sst count="7" uniqueCount="7">
          <si><t>Resumo da Fatura</t></si>
          <si><t>Titular: Fulano</t></si>
          <si><t>Data</t></si>
          <si><t>Estabelecimento</t></si>
          <si><t>Valor</t></si>
          <si><t>Padaria Estrela</t></si>
          <si><t>Mercado Central</t></si>
        </sst>`,
      "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet>
          <cellXfs count="2">
            <xf numFmtId="0" />
            <xf numFmtId="14" />
          </cellXfs>
        </styleSheet>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet><sheetData>
          <row r="1"><c r="A1" t="s"><v>0</v></c></row>
          <row r="2"><c r="A2" t="s"><v>1</v></c></row>
        </sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet><sheetData>
          <row r="1">
            <c r="A1" t="s"><v>2</v></c>
            <c r="B1" t="s"><v>3</v></c>
            <c r="C1" t="s"><v>4</v></c>
          </row>
          <row r="2">
            <c r="A2" s="1"><v>46340</v></c>
            <c r="B2" t="s"><v>5</v></c>
            <c r="C2"><v>45.90</v></c>
          </row>
          <row r="3">
            <c r="A3" s="1"><v>46341</v></c>
            <c r="B3" t="s"><v>6</v></c>
            <c r="C3"><v>140.49999999999997</v></c>
          </row>
        </sheetData></worksheet>`,
    });

    const rows = await parseSpreadsheetOrHtmlToRows(xlsxBuffer);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.cells).toEqual(["Data", "Estabelecimento", "Valor"]);
    expect(rows[1]?.cells).toEqual(["2026-11-14", "Padaria Estrela", "45.90"]);
    expect(rows[2]?.cells).toEqual(["2026-11-15", "Mercado Central", "140.50"]);
  });

  it("corrige ruído IEEE-754 e notação científica preservando inteiros intactos (#21)", () => {
    expect(normalizeSpreadsheetNumericCellValue("140.49999999999997")).toBe("140.50");
    expect(normalizeSpreadsheetNumericCellValue("12.300000000000001")).toBe("12.30");
    expect(normalizeSpreadsheetNumericCellValue("2.5E+3")).toBe("2500");
    // Inteiros (datas seriais sem estilo, finais de cartão) NÃO recebem .toFixed(2)
    expect(normalizeSpreadsheetNumericCellValue("46340")).toBe("46340");
    expect(normalizeSpreadsheetNumericCellValue("2107")).toBe("2107");
    // Float legítimo com 3 casas fora da tolerância 1e-6 permanece intacto
    expect(normalizeSpreadsheetNumericCellValue("1.525")).toBe("1.525");
  });

  it("suporta células t='d' (ISO-8601 nativo) e formatos customizados de data com hora hh:mm:00 (#22)", async () => {
    const xlsxBuffer = await buildMinimalXlsxBuffer({
      "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <sst count="5" uniqueCount="5">
          <si><t>Data</t></si>
          <si><t>Descricao</t></si>
          <si><t>Valor</t></si>
          <si><t>Restaurante ISO</t></si>
          <si><t>Cafeteria Hora</t></si>
        </sst>`,
      "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet>
          <numFmts count="1">
            <numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm:00" />
          </numFmts>
          <cellXfs count="2">
            <xf numFmtId="0" />
            <xf numFmtId="164" />
          </cellXfs>
        </styleSheet>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet><sheetData>
          <row r="1">
            <c r="A1" t="s"><v>0</v></c>
            <c r="B1" t="s"><v>1</v></c>
            <c r="C1" t="s"><v>2</v></c>
          </row>
          <row r="2">
            <c r="A2" t="d"><v>2026-11-15T14:30:00Z</v></c>
            <c r="B2" t="s"><v>3</v></c>
            <c r="C2"><v>89.50</v></c>
          </row>
          <row r="3">
            <c r="A3" s="1"><v>46342.625</v></c>
            <c r="B3" t="s"><v>4</v></c>
            <c r="C3"><v>2.5E+2</v></c>
          </row>
        </sheetData></worksheet>`,
    });

    const rows = await parseSpreadsheetOrHtmlToRows(xlsxBuffer);
    expect(rows).toHaveLength(3);
    expect(rows[1]?.cells).toEqual(["2026-11-15", "Restaurante ISO", "89.50"]);
    expect(rows[2]?.cells).toEqual(["2026-11-16", "Cafeteria Hora", "250"]);
  });
});
