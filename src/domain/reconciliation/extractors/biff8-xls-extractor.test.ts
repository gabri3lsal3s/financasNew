import { describe, expect, it } from "vitest";
import { parseBiff8XlsToRows } from "./biff8-xls-extractor";
import { parseSpreadsheetOrHtmlToRows } from "./spreadsheet-extractor";

function writeU16(arr: number[], val: number) {
  arr.push(val & 0xff, (val >> 8) & 0xff);
}

function writeU32(arr: number[], val: number) {
  arr.push(val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff);
}

function writeF64(arr: number[], val: number) {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, val, true);
  for (const b of new Uint8Array(buf)) arr.push(b);
}

function biffRecord(id: number, payload: number[]): number[] {
  const out: number[] = [];
  writeU16(out, id);
  writeU16(out, payload.length);
  out.push(...payload);
  return out;
}

function encodeBiff8String16(str: string): number[] {
  const out: number[] = [];
  writeU16(out, str.length);
  out.push(0); // compressed Latin1
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff);
  return out;
}

function encodeBiff8String8(str: string): number[] {
  const out: number[] = [str.length, 0];
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff);
  return out;
}

function buildMinimalOle2WithWorkbook(workbookBytes: Uint8Array): ArrayBuffer {
  const sectorSize = 512;
  const wbSectors = Math.max(1, Math.ceil(workbookBytes.length / sectorSize));
  const dirSector = 1 + wbSectors;
  const fatSector = dirSector + 1;
  const totalSectors = fatSector + 1;

  const out = new Uint8Array((1 + totalSectors) * sectorSize);
  const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  out.set(magic, 0);

  const dv = new DataView(out.buffer);
  dv.setUint16(24, 0x003e, true);
  dv.setUint16(26, 0x0003, true);
  dv.setUint16(28, 0xfffe, true);
  dv.setUint16(30, 9, true); // 512
  dv.setUint16(32, 6, true); // 64
  dv.setUint32(44, 1, true); // 1 FAT sector
  dv.setUint32(48, dirSector, true);
  dv.setUint32(56, 0x1000, true); // miniCutoff 4096
  dv.setUint32(60, 0xfffffffe, true);
  dv.setUint32(68, 0xfffffffe, true);

  for (let i = 0; i < 109; i++) {
    dv.setUint32(76 + i * 4, i === 0 ? fatSector : 0xffffffff, true);
  }

  // Workbook sectors start at sector 0 (file offset 512)
  out.set(workbookBytes, sectorSize);

  // Directory entries (sector `dirSector`)
  const dirOff = (1 + dirSector) * sectorSize;
  const writeDirName = (entryOff: number, name: string) => {
    for (let i = 0; i < name.length; i++) {
      dv.setUint16(entryOff + i * 2, name.charCodeAt(i), true);
    }
    dv.setUint16(entryOff + 64, (name.length + 1) * 2, true);
  };
  writeDirName(dirOff, "Root Entry");
  out[dirOff + 66] = 5;
  dv.setUint32(dirOff + 116, 0xfffffffe, true);

  const wbEntryOff = dirOff + 128;
  writeDirName(wbEntryOff, "Workbook");
  out[wbEntryOff + 66] = 2;
  dv.setUint32(wbEntryOff + 116, 0, true);
  dv.setUint32(wbEntryOff + 120, workbookBytes.length, true);

  // FAT sector
  const fatOff = (1 + fatSector) * sectorSize;
  for (let s = 0; s < wbSectors; s++) {
    dv.setUint32(fatOff + s * 4, s + 1 < wbSectors ? s + 1 : 0xfffffffe, true);
  }
  dv.setUint32(fatOff + dirSector * 4, 0xfffffffe, true);
  dv.setUint32(fatOff + fatSector * 4, 0xfffffffd, true);

  return out.buffer;
}

describe("biff8-xls-extractor — Leitor puro OLE2 / BIFF8 (.xls legado)", () => {
  it("extrai cabeçalho, datas seriais Excel, strings SST e valores numéricos/RK de arquivo .xls BIFF8 real", async () => {
    const sstStrings = ["Data", "Estabelecimento", "Valor", "Padaria Central", "Mercado Sul"];
    const sstPayload: number[] = [];
    writeU32(sstPayload, sstStrings.length);
    writeU32(sstPayload, sstStrings.length);
    for (const s of sstStrings) sstPayload.push(...encodeBiff8String16(s));

    const xf0 = [0, 0, 0, 0, ...new Array(16).fill(0)]; // general
    const xf1 = [0, 0, 14, 0, ...new Array(16).fill(0)]; // numFmtId 14 (date)

    const globalsHeader: number[] = [
      ...biffRecord(0x0809, [0x00, 0x06, 0x05, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...biffRecord(0x0022, [0, 0]), // 1900 date mode
      ...biffRecord(0x00e0, xf0),
      ...biffRecord(0x00e0, xf1),
      ...biffRecord(0x00fc, sstPayload),
    ];

    const bsPlaceholder = biffRecord(0x0085, [0, 0, 0, 0, 0, 0, ...encodeBiff8String8("Fatura")]);
    const globalsEof = biffRecord(0x000a, []);
    const sheetStartOffset = globalsHeader.length + bsPlaceholder.length + globalsEof.length;

    const bsPayload = [0, 0, 0, 0, 0, 0, ...encodeBiff8String8("Fatura")];
    bsPayload[0] = sheetStartOffset & 0xff;
    bsPayload[1] = (sheetStartOffset >> 8) & 0xff;
    bsPayload[2] = (sheetStartOffset >> 16) & 0xff;
    bsPayload[3] = (sheetStartOffset >> 24) & 0xff;

    const makeLabelSst = (r: number, c: number, idx: number) => {
      const p: number[] = [];
      writeU16(p, r);
      writeU16(p, c);
      writeU16(p, 0);
      writeU32(p, idx);
      return biffRecord(0x00fd, p);
    };
    const makeNumber = (r: number, c: number, xf: number, val: number) => {
      const p: number[] = [];
      writeU16(p, r);
      writeU16(p, c);
      writeU16(p, xf);
      writeF64(p, val);
      return biffRecord(0x0203, p);
    };
    const makeRkInt100 = (r: number, c: number, cents: number) => {
      const p: number[] = [];
      writeU16(p, r);
      writeU16(p, c);
      writeU16(p, 0);
      const rk = (cents << 2) | 0x03; // isInt + div100
      writeU32(p, rk >>> 0);
      return biffRecord(0x027e, p);
    };

    const sheetBytes: number[] = [
      ...biffRecord(0x0809, [0x00, 0x06, 0x10, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...makeLabelSst(0, 0, 0),
      ...makeLabelSst(0, 1, 1),
      ...makeLabelSst(0, 2, 2),
      ...makeNumber(1, 0, 1, 46249), // 2026-08-15
      ...makeLabelSst(1, 1, 3),
      ...makeNumber(1, 2, 0, 42.5),
      ...makeNumber(2, 0, 1, 46250), // 2026-08-16
      ...makeLabelSst(2, 1, 4),
      ...makeRkInt100(2, 2, 12990), // 129.90
      ...biffRecord(0x000a, []),
    ];

    // Pad >= 4096 bytes so it uses main FAT chain cleanly
    const wb = new Uint8Array(Math.max(4096, sheetStartOffset + sheetBytes.length));
    wb.set([...globalsHeader, ...biffRecord(0x0085, bsPayload), ...globalsEof, ...sheetBytes], 0);

    const oleBuffer = buildMinimalOle2WithWorkbook(wb);
    const rows = await parseSpreadsheetOrHtmlToRows(oleBuffer);

    expect(rows).toHaveLength(3);
    expect(rows[0]?.cells).toEqual(["Data", "Estabelecimento", "Valor"]);
    expect(rows[1]?.cells).toEqual(["2026-08-15", "Padaria Central", "42.5"]);
    expect(rows[2]?.cells).toEqual(["2026-08-16", "Mercado Sul", "129.9"]);
  });

  it("falha com orientação clara quando a planilha .xls está protegida por senha (FILEPASS)", () => {
    const wb = new Uint8Array(4096);
    const recs = [
      ...biffRecord(0x0809, [0x00, 0x06, 0x05, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...biffRecord(0x002f, [0, 0, 0, 0]), // FILEPASS
      ...biffRecord(0x000a, []),
    ];
    wb.set(recs, 0);
    const oleBuffer = buildMinimalOle2WithWorkbook(wb);

    expect(() => parseBiff8XlsToRows(new Uint8Array(oleBuffer))).toThrow(
      /protegida por senha/i,
    );
  });
});
