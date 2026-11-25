import { describe, expect, it } from "vitest";
import { detectFileKindFromBytes } from "./magic-bytes";

function encodeLatin1(text: string): Uint8Array {
  return new Uint8Array(Array.from(text, (ch) => ch.charCodeAt(0) & 0xff));
}

function makeZipLocalHeaderBytes(entryName: string): Uint8Array {
  const nameBytes = new TextEncoder().encode(entryName);
  const header = new Uint8Array(30 + nameBytes.length);
  header[0] = 0x50;
  header[1] = 0x4b;
  header[2] = 0x03;
  header[3] = 0x04;
  header[4] = 0x14;
  header[5] = 0x00;
  header[26] = nameBytes.length & 0xff;
  header[27] = (nameBytes.length >>> 8) & 0xff;
  header.set(nameBytes, 30);
  return header;
}

function makeFtypHeaderBytes(majorBrand: string, compatBrands: string[] = []): Uint8Array {
  const boxSize = 16 + compatBrands.length * 4;
  const buf = new Uint8Array(boxSize);
  buf[0] = (boxSize >>> 24) & 0xff;
  buf[1] = (boxSize >>> 16) & 0xff;
  buf[2] = (boxSize >>> 8) & 0xff;
  buf[3] = boxSize & 0xff;
  const enc = new TextEncoder();
  buf.set(enc.encode("ftyp"), 4);
  buf.set(enc.encode(majorBrand.padEnd(4, " ").slice(0, 4)), 8);
  compatBrands.forEach((b, idx) => {
    buf.set(enc.encode(b.padEnd(4, " ").slice(0, 4)), 16 + idx * 4);
  });
  return buf;
}

describe("magic-bytes — Sniffer de Estágio 0 (OOXML, HEIC/HEIF/AVIF e Formatos Bancários)", () => {
  it("identifica PDF pelos magic bytes %PDF- mesmo sem extensão ou MIME", () => {
    const bytes = encodeLatin1("%PDF-1.7\n1 0 obj\n<<>>");
    expect(detectFileKindFromBytes(bytes, "fatura_whatsapp_download")).toBe("pdf");
  });

  it("identifica XLSX real apenas quando ZIP OOXML contém xl/workbook.xml ou xl/worksheets/", () => {
    const xlsxZip = makeZipLocalHeaderBytes("xl/workbook.xml");
    expect(detectFileKindFromBytes(xlsxZip, "arquivo_sem_extensao")).toBe("xlsx");

    const sheetZip = makeZipLocalHeaderBytes("xl/worksheets/sheet1.xml");
    expect(detectFileKindFromBytes(sheetZip, "planilha")).toBe("xlsx");
  });

  it("classifica ZIP comum ou DOCX sem entradas OOXML de planilha como unsupported_archive", () => {
    const docxZip = makeZipLocalHeaderBytes("word/document.xml");
    expect(detectFileKindFromBytes(docxZip, "contrato.docx")).toBe("unsupported_archive");
    expect(detectFileKindFromBytes(docxZip, "fatura.xlsx")).toBe("unsupported_archive");

    const genericZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(detectFileKindFromBytes(genericZip, "arquivo.zip")).toBe("unsupported_archive");
  });

  it("identifica Excel binário legado BIFF8 (D0 CF 11 E0) como xls_biff8", () => {
    const bytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(detectFileKindFromBytes(bytes, "fatura.xls")).toBe("xls_biff8");
  });

  it("identifica OFX/QFX pelo preâmbulo OFXHEADER: ou <OFX> mesmo salvo como .txt", () => {
    const sgml = encodeLatin1("OFXHEADER:100\nDATA:OFXSGML\n<OFX><BANKMSGSRSV1>");
    expect(detectFileKindFromBytes(sgml, "extrato.txt")).toBe("ofx");

    const xml = encodeLatin1('<?xml version="1.0"?>\n<OFX><CREDITCARDMSGSRSV1>');
    expect(detectFileKindFromBytes(xml, "download")).toBe("ofx");
  });

  it("identifica planilhas HTML/SpreadsheetML disfarçadas de .xls ou sem extensão", () => {
    const html = encodeLatin1(
      "<html><body><table><tr><td>Data</td><td>Valor</td></tr></table></body></html>",
    );
    expect(detectFileKindFromBytes(html, "fatura.xls")).toBe("html_or_xml_sheet");

    const xmlSheet = encodeLatin1(
      "<Workbook><Worksheet><Table><Row><Cell>1</Cell></Row></Table></Worksheet></Workbook>",
    );
    expect(detectFileKindFromBytes(xmlSheet, "extrato")).toBe("html_or_xml_sheet");
  });

  it("identifica imagens PNG, JPEG, WEBP, HEIC, HEIF e AVIF pelos magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const heic = makeFtypHeaderBytes("heic");
    const heifMif1 = makeFtypHeaderBytes("mif1");
    const avif = makeFtypHeaderBytes("avif");
    const isomCompatHeic = makeFtypHeaderBytes("isom", ["heix"]);

    expect(detectFileKindFromBytes(png, "print_fatura")).toBe("image");
    expect(detectFileKindFromBytes(jpg, "IMG_20261115")).toBe("image");
    expect(detectFileKindFromBytes(webp, "screenshot")).toBe("image");
    expect(detectFileKindFromBytes(heic, "IMG_001.heic")).toBe("image");
    expect(detectFileKindFromBytes(heifMif1, "IMG_002.heif")).toBe("image");
    expect(detectFileKindFromBytes(avif, "fatura_print.avif")).toBe("image");
    expect(detectFileKindFromBytes(isomCompatHeic, "foto_sem_extensao")).toBe("image");
  });

  it("faz fallback para text_or_csv em arquivos CSV comuns", () => {
    const csv = encodeLatin1("Data;Descrição;Valor\n15/11/2026;Padaria;25,00");
    expect(detectFileKindFromBytes(csv, "fatura.csv")).toBe("text_or_csv");
  });
});
