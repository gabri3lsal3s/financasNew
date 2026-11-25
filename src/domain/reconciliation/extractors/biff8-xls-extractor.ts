import type { RawParsedRow } from "../contracts";
import { EncryptedSpreadsheetError, isEncryptedOle2OfficeFile } from "./ole2-crypto";

const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;

const BIFF_FILEPASS = 0x002f;
const BIFF_DATEMODE = 0x0022;
const BIFF_BOUNDSHEET = 0x0085;
const BIFF_FORMAT = 0x041e;
const BIFF_XF = 0x00e0;
const BIFF_SST = 0x00fc;
const BIFF_CONTINUE = 0x003c;
const BIFF_BOF = 0x0809;
const BIFF_EOF = 0x000a;
const BIFF_LABEL = 0x0204;
const BIFF_RSTRING = 0x00d6;
const BIFF_LABELSST = 0x00fd;
const BIFF_NUMBER = 0x0203;
const BIFF_RK = 0x027e;
const BIFF_MULRK = 0x00bd;
const BIFF_FORMULA = 0x0006;
const BIFF_STRING = 0x0207;

const BUILTIN_DATE_FORMAT_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 36, 45, 46, 47, 50, 51, 52, 53,
  54, 55, 56, 57, 58,
]);

function u16(b: Uint8Array, o: number): number {
  return (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
}

function u32(b: Uint8Array, o: number): number {
  return (
    ((b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16) | ((b[o + 3] ?? 0) << 24)) >>>
    0
  );
}

function i32(b: Uint8Array, o: number): number {
  return u32(b, o) | 0;
}

function f64(b: Uint8Array, o: number): number {
  const view = new DataView(b.buffer, b.byteOffset + o, 8);
  return view.getFloat64(0, true);
}

function decodeUtf16Le(b: Uint8Array, o: number, charCount: number): string {
  const end = Math.min(b.length, o + charCount * 2);
  let out = "";
  for (let p = o; p + 1 < end; p += 2) {
    out += String.fromCharCode(u16(b, p));
  }
  return out;
}

function decodeLatin1(b: Uint8Array, o: number, len: number): string {
  const end = Math.min(b.length, o + len);
  let out = "";
  for (let p = o; p < end; p++) {
    out += String.fromCharCode(b[p] ?? 0);
  }
  return out;
}

function excelSerialToIso(serial: number, is1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100_000) return null;
  const baseMs = is1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const wholeDays = Math.floor(serial + 1e-9);
  const d = new Date(baseMs + wholeDays * 86_400_000);
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isCustomDateFormatCode(fmt: string): boolean {
  const clean = fmt
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .toLowerCase();
  return (clean.includes("d") && clean.includes("m")) || (clean.includes("y") && clean.includes("m"));
}

function decodeRkValue(rk: number): number {
  const isDiv100 = (rk & 0x01) !== 0;
  const isInt = (rk & 0x02) !== 0;
  let val: number;
  if (isInt) {
    val = rk >> 2;
  } else {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setUint32(0, 0, true);
    dv.setUint32(4, rk & 0xfffffffc, true);
    val = dv.getFloat64(0, true);
  }
  return isDiv100 ? val / 100 : val;
}

function formatNumericCell(val: number, isDate: boolean, is1904: boolean): string {
  if (!Number.isFinite(val)) return "";
  if (isDate) {
    const iso = excelSerialToIso(val, is1904);
    if (iso) return iso;
  }
  if (Number.isInteger(val)) return String(val);
  return String(Number(val.toFixed(6)));
}

function extractOle2WorkbookStream(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 512) return null;
  for (let i = 0; i < OLE2_MAGIC.length; i++) {
    if (bytes[i] !== OLE2_MAGIC[i]) return null;
  }

  const sectorShift = u16(bytes, 30);
  const sectorSize = 1 << sectorShift;
  const miniSectorShift = u16(bytes, 32);
  const miniSectorSize = 1 << miniSectorShift;
  const numFatSectors = u32(bytes, 44);
  const firstDirSector = u32(bytes, 48);
  const miniCutoff = u32(bytes, 56);
  const firstMiniFatSector = u32(bytes, 60);
  const numMiniFatSectors = u32(bytes, 64);
  const firstDifatSector = u32(bytes, 68);
  const numDifatSectors = u32(bytes, 72);

  if (sectorSize !== 512 && sectorSize !== 4096) return null;

  const sectorOffset = (sec: number) => 512 + sec * sectorSize;
  const readSector = (sec: number): Uint8Array => {
    const off = sectorOffset(sec);
    if (off < 0 || off + sectorSize > bytes.length) return new Uint8Array(0);
    return bytes.subarray(off, off + sectorSize);
  };

  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < numFatSectors; i++) {
    const s = u32(bytes, 76 + i * 4);
    if (s < FATSECT) fatSectors.push(s);
  }
  let difatSec = firstDifatSector;
  let difatGuard = 0;
  while (
    difatSec < FATSECT &&
    fatSectors.length < numFatSectors &&
    difatGuard++ < numDifatSectors + 2
  ) {
    const secData = readSector(difatSec);
    if (secData.length < sectorSize) break;
    const perSec = sectorSize / 4 - 1;
    for (let i = 0; i < perSec && fatSectors.length < numFatSectors; i++) {
      const s = u32(secData, i * 4);
      if (s < FATSECT) fatSectors.push(s);
    }
    difatSec = u32(secData, sectorSize - 4);
  }

  const fat: number[] = [];
  for (const s of fatSectors) {
    const secData = readSector(s);
    for (let o = 0; o + 4 <= secData.length; o += 4) {
      fat.push(u32(secData, o));
    }
  }

  const readChain = (startSec: number, expectedLen?: number): Uint8Array => {
    if (startSec >= FATSECT) return new Uint8Array(0);
    const chunks: Uint8Array[] = [];
    const visited = new Set<number>();
    let cur = startSec;
    while (cur < FATSECT && !visited.has(cur)) {
      visited.add(cur);
      const chunk = readSector(cur);
      if (chunk.length === 0) break;
      chunks.push(chunk);
      cur = fat[cur] ?? ENDOFCHAIN;
    }
    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(expectedLen !== undefined ? Math.min(expectedLen, total) : total);
    let pos = 0;
    for (const c of chunks) {
      const copyLen = Math.min(c.length, out.length - pos);
      if (copyLen <= 0) break;
      out.set(c.subarray(0, copyLen), pos);
      pos += copyLen;
    }
    return out;
  };

  const dirData = readChain(firstDirSector);
  if (dirData.length < 128) return null;

  let rootStart = ENDOFCHAIN;
  let rootSize = 0;
  let workbookEntry: { start: number; size: number; type: number } | null = null;

  for (let off = 0; off + 128 <= dirData.length; off += 128) {
    const entryType = dirData[off + 66] ?? 0;
    if (entryType === 0) continue;
    const nameLen = u16(dirData, off + 64);
    const chars = Math.max(0, Math.floor((nameLen - 2) / 2));
    const name = decodeUtf16Le(dirData, off, chars).toLowerCase();
    const startSec = u32(dirData, off + 116);
    const streamSize = u32(dirData, off + 120);

    if (entryType === 5) {
      rootStart = startSec;
      rootSize = streamSize;
    } else if (entryType === 2 && (name === "workbook" || name === "book")) {
      workbookEntry = { start: startSec, size: streamSize, type: entryType };
      break;
    }
  }

  if (!workbookEntry || workbookEntry.size === 0) return null;
  if (workbookEntry.size >= miniCutoff) {
    return readChain(workbookEntry.start, workbookEntry.size);
  }

  const miniStream = readChain(rootStart, rootSize);
  const miniFatRaw =
    firstMiniFatSector < FATSECT && numMiniFatSectors > 0 ? readChain(firstMiniFatSector) : new Uint8Array(0);
  const miniFat: number[] = [];
  for (let o = 0; o + 4 <= miniFatRaw.length; o += 4) {
    miniFat.push(u32(miniFatRaw, o));
  }

  const out = new Uint8Array(workbookEntry.size);
  const visitedMini = new Set<number>();
  let curMini = workbookEntry.start;
  let pos = 0;
  while (curMini < FATSECT && !visitedMini.has(curMini) && pos < out.length) {
    visitedMini.add(curMini);
    const mOff = curMini * miniSectorSize;
    const copyLen = Math.min(miniSectorSize, out.length - pos, Math.max(0, miniStream.length - mOff));
    if (copyLen <= 0) break;
    out.set(miniStream.subarray(mOff, mOff + copyLen), pos);
    pos += copyLen;
    curMini = miniFat[curMini] ?? ENDOFCHAIN;
  }
  return out;
}

function readBiffStringWithContinue(
  chunks: readonly Uint8Array[],
  state: { chunkIdx: number; offset: number },
  totalChars: number,
  initialFlags: number,
): string {
  let remaining = totalChars;
  let isUtf16 = (initialFlags & 0x01) !== 0;
  let out = "";

  while (remaining > 0 && state.chunkIdx < chunks.length) {
    const chunk = chunks[state.chunkIdx]!;
    if (state.offset >= chunk.length) {
      state.chunkIdx += 1;
      if (state.chunkIdx >= chunks.length) break;
      const nextChunk = chunks[state.chunkIdx]!;
      const contFlag = nextChunk[0] ?? 0;
      isUtf16 = (contFlag & 0x01) !== 0;
      state.offset = 1;
      continue;
    }
    const availBytes = chunk.length - state.offset;
    const bytesPerChar = isUtf16 ? 2 : 1;
    const canReadChars = Math.min(remaining, Math.floor(availBytes / bytesPerChar));
    if (canReadChars <= 0) {
      state.offset = chunk.length;
      continue;
    }
    out += isUtf16
      ? decodeUtf16Le(chunk, state.offset, canReadChars)
      : decodeLatin1(chunk, state.offset, canReadChars);
    state.offset += canReadChars * bytesPerChar;
    remaining -= canReadChars;
  }

  return out;
}

function parseSstTable(chunks: readonly Uint8Array[]): string[] {
  if (chunks.length === 0 || chunks[0]!.length < 8) return [];
  const totalUnique = u32(chunks[0]!, 4);
  const state = { chunkIdx: 0, offset: 8 };
  const strings: string[] = [];

  const ensureBytes = (needed: number): boolean => {
    while (state.chunkIdx < chunks.length) {
      const c = chunks[state.chunkIdx]!;
      if (state.offset + needed <= c.length) return true;
      state.chunkIdx += 1;
      state.offset = 0;
    }
    return false;
  };

  for (let i = 0; i < totalUnique && i < 200_000; i++) {
    if (!ensureBytes(3)) break;
    const c = chunks[state.chunkIdx]!;
    const cch = u16(c, state.offset);
    const flags = c[state.offset + 2] ?? 0;
    state.offset += 3;

    let richRuns = 0;
    let extLen = 0;
    if ((flags & 0x08) !== 0 && ensureBytes(2)) {
      richRuns = u16(chunks[state.chunkIdx]!, state.offset);
      state.offset += 2;
    }
    if ((flags & 0x04) !== 0 && ensureBytes(4)) {
      extLen = u32(chunks[state.chunkIdx]!, state.offset);
      state.offset += 4;
    }

    const str = readBiffStringWithContinue(chunks, state, cch, flags);
    strings.push(str);

    let skipBytes = richRuns * 4 + extLen;
    while (skipBytes > 0 && state.chunkIdx < chunks.length) {
      const cur = chunks[state.chunkIdx]!;
      const avail = cur.length - state.offset;
      if (avail >= skipBytes) {
        state.offset += skipBytes;
        skipBytes = 0;
      } else {
        skipBytes -= avail;
        state.chunkIdx += 1;
        state.offset = 0;
      }
    }
  }

  return strings;
}

function parseShortBiffString(data: Uint8Array, offset: number, oneByteLen = false): string {
  if (offset >= data.length) return "";
  const len = oneByteLen ? (data[offset] ?? 0) : u16(data, offset);
  const flagsOff = offset + (oneByteLen ? 1 : 2);
  const flags = data[flagsOff] ?? 0;
  const strOff = flagsOff + 1;
  return (flags & 0x01) !== 0
    ? decodeUtf16Le(data, strOff, len)
    : decodeLatin1(data, strOff, len);
}

/**
 * Extrator puro para planilhas Excel binárias legadas (.xls / OLE2 BIFF8).
 */
export function parseBiff8XlsToRows(
  bytes: Uint8Array,
  scoreRowsFn?: (rows: RawParsedRow[]) => number,
): RawParsedRow[] {
  if (isEncryptedOle2OfficeFile(bytes)) {
    throw new EncryptedSpreadsheetError("ENCRYPTED_SPREADSHEET");
  }
  const stream = extractOle2WorkbookStream(bytes);
  if (!stream || stream.length < 4) return [];

  let is1904 = false;
  const customFormats = new Map<number, string>();
  const xfFormatIds: number[] = [];
  const sheetOffsets: number[] = [];
  let sstStrings: string[] = [];

  let cursor = 0;
  while (cursor + 4 <= stream.length) {
    const recId = u16(stream, cursor);
    const recLen = u16(stream, cursor + 2);
    const recStart = cursor + 4;
    const recEnd = Math.min(stream.length, recStart + recLen);
    const data = stream.subarray(recStart, recEnd);
    cursor = recEnd;

    if (recId === BIFF_FILEPASS) {
      throw new EncryptedSpreadsheetError(
        "UNSUPPORTED_SPREADSHEET_ENCRYPTION",
        "Esta planilha .xls está protegida por senha ou criptografada. Remova a proteção ou salve como .xlsx ou .csv para importar.",
      );
    }
    if (recId === BIFF_DATEMODE && data.length >= 2) {
      is1904 = u16(data, 0) === 1;
    } else if (recId === BIFF_FORMAT && data.length >= 5) {
      const fmtId = u16(data, 0);
      customFormats.set(fmtId, parseShortBiffString(data, 2, false));
    } else if (recId === BIFF_XF && data.length >= 4) {
      xfFormatIds.push(u16(data, 2));
    } else if (recId === BIFF_BOUNDSHEET && data.length >= 8) {
      sheetOffsets.push(u32(data, 0));
    } else if (recId === BIFF_SST) {
      const sstChunks: Uint8Array[] = [data];
      while (cursor + 4 <= stream.length && u16(stream, cursor) === BIFF_CONTINUE) {
        const contLen = u16(stream, cursor + 2);
        const contStart = cursor + 4;
        const contEnd = Math.min(stream.length, contStart + contLen);
        sstChunks.push(stream.subarray(contStart, contEnd));
        cursor = contEnd;
      }
      sstStrings = parseSstTable(sstChunks);
    } else if (recId === BIFF_EOF) {
      break;
    }
  }

  const isDateXf = (xfIdx: number): boolean => {
    const fmtId = xfFormatIds[xfIdx];
    if (fmtId === undefined) return false;
    if (BUILTIN_DATE_FORMAT_IDS.has(fmtId)) return true;
    const fmtStr = customFormats.get(fmtId);
    return fmtStr ? isCustomDateFormatCode(fmtStr) : false;
  };

  const parseSheetAt = (startOffset: number): RawParsedRow[] => {
    const rowsMap = new Map<number, string[]>();
    const setCell = (r: number, c: number, val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return;
      const arr = rowsMap.get(r) ?? [];
      while (arr.length <= c) arr.push("");
      arr[c] = trimmed;
      rowsMap.set(r, arr);
    };

    let pos = startOffset;
    let sawBof = false;
    let lastFormulaCell: { r: number; c: number } | null = null;
    while (pos + 4 <= stream.length) {
      const recId = u16(stream, pos);
      const recLen = u16(stream, pos + 2);
      const recStart = pos + 4;
      const recEnd = Math.min(stream.length, recStart + recLen);
      const data = stream.subarray(recStart, recEnd);
      pos = recEnd;

      if (recId === BIFF_BOF) {
        sawBof = true;
        continue;
      }
      if (recId === BIFF_EOF && sawBof) break;

      if (recId === BIFF_LABELSST && data.length >= 10) {
        setCell(u16(data, 0), u16(data, 2), sstStrings[u32(data, 6)] ?? "");
      } else if ((recId === BIFF_LABEL || recId === BIFF_RSTRING) && data.length >= 8) {
        setCell(u16(data, 0), u16(data, 2), parseShortBiffString(data, 6, false));
      } else if (recId === BIFF_NUMBER && data.length >= 14) {
        const xf = u16(data, 4);
        setCell(u16(data, 0), u16(data, 2), formatNumericCell(f64(data, 6), isDateXf(xf), is1904));
      } else if (recId === BIFF_RK && data.length >= 10) {
        const xf = u16(data, 4);
        setCell(u16(data, 0), u16(data, 2), formatNumericCell(decodeRkValue(i32(data, 6)), isDateXf(xf), is1904));
      } else if (recId === BIFF_MULRK && data.length >= 10) {
        const r = u16(data, 0);
        const firstCol = u16(data, 2);
        const count = Math.floor((data.length - 6) / 6);
        for (let k = 0; k < count; k++) {
          const xf = u16(data, 4 + k * 6);
          const rk = i32(data, 6 + k * 6);
          setCell(r, firstCol + k, formatNumericCell(decodeRkValue(rk), isDateXf(xf), is1904));
        }
      } else if (recId === BIFF_FORMULA && data.length >= 14) {
        const r = u16(data, 0);
        const c = u16(data, 2);
        const xf = u16(data, 4);
        if (u16(data, 12) === 0xffff && data[6] === 0) {
          lastFormulaCell = { r, c };
        } else {
          setCell(r, c, formatNumericCell(f64(data, 6), isDateXf(xf), is1904));
          lastFormulaCell = null;
        }
        continue;
      } else if (recId === BIFF_STRING && lastFormulaCell && data.length >= 3) {
        setCell(lastFormulaCell.r, lastFormulaCell.c, parseShortBiffString(data, 0, false));
      }
      lastFormulaCell = null;
    }

    return Array.from(rowsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rowIndex, cells]) => ({
        rowIndex,
        rawText: cells.join("\t"),
        cells,
      }))
      .filter((r) => r.cells.some((c) => c.trim().length > 0));
  };

  if (sheetOffsets.length === 0) return [];
  let bestRows: RawParsedRow[] = [];
  let bestScore = -1;
  for (const off of sheetOffsets) {
    const candidate = parseSheetAt(off);
    const score = scoreRowsFn ? scoreRowsFn(candidate) : candidate.length;
    if (score > bestScore || (bestRows.length === 0 && candidate.length > 0)) {
      bestScore = score;
      bestRows = candidate;
    }
  }
  return bestRows;
}
