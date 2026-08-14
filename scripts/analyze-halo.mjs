import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function decodePng(buffer) {
  let offset = 8;
  let width = 0, height = 0, colorType = 6;
  const idatChunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") break;
  }
  const decompressed = inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * bpp + 1;
  const raw = Buffer.alloc(width * height * 4);
  let prevRow = Buffer.alloc(width * bpp);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    const filterType = decompressed[rowOffset];
    const currentRow = Buffer.alloc(width * bpp);

    for (let x = 0; x < width * bpp; x++) {
      const rawByte = decompressed[rowOffset + 1 + x];
      const a = x >= bpp ? currentRow[x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;
      let val = rawByte;
      if (filterType === 0) val = rawByte;
      else if (filterType === 1) val = (rawByte + a) & 0xff;
      else if (filterType === 2) val = (rawByte + b) & 0xff;
      else if (filterType === 3) val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (rawByte + pr) & 0xff;
      }
      currentRow[x] = val;
    }

    for (let px = 0; px < width; px++) {
      const srcIdx = px * bpp;
      const dstIdx = (y * width + px) * 4;
      if (colorType === 6) {
        raw[dstIdx] = currentRow[srcIdx];
        raw[dstIdx + 1] = currentRow[srcIdx + 1];
        raw[dstIdx + 2] = currentRow[srcIdx + 2];
        raw[dstIdx + 3] = currentRow[srcIdx + 3];
      } else if (colorType === 2) {
        raw[dstIdx] = currentRow[srcIdx];
        raw[dstIdx + 1] = currentRow[srcIdx + 1];
        raw[dstIdx + 2] = currentRow[srcIdx + 2];
        raw[dstIdx + 3] = 255;
      }
    }
    prevRow = currentRow;
  }
  return { width, height, data: raw };
}

const semFundo = decodePng(readFileSync("identidadeVisual/foto-sem-fundo.png"));
console.log("semFundo:", semFundo.width, "x", semFundo.height);

// Count pixels that are almost white with high alpha on the periphery
let whiteHaloCount = 0;
for (let y = 0; y < semFundo.height; y++) {
  for (let x = 0; x < semFundo.width; x++) {
    const idx = (y * semFundo.width + x) * 4;
    const r = semFundo.data[idx];
    const g = semFundo.data[idx + 1];
    const b = semFundo.data[idx + 2];
    const a = semFundo.data[idx + 3];
    if (a > 100 && r > 230 && g > 230 && b > 230) {
      // Check if it's near transparent background (within 5 pixels of an alpha < 10 pixel)
      let nearEdge = false;
      for (let dy = -5; dy <= 5 && !nearEdge; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= semFundo.height || nx < 0 || nx >= semFundo.width) {
            nearEdge = true;
            break;
          }
          const nidx = (ny * semFundo.width + nx) * 4;
          if (semFundo.data[nidx + 3] < 10) {
            nearEdge = true;
            break;
          }
        }
      }
      if (nearEdge) {
        whiteHaloCount++;
      }
    }
  }
}
console.log("White halo pixels near edge:", whiteHaloCount);
