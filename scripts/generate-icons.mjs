// Gera e processa os assets oficiais da marca "Guia Financeiro" a partir
// de identidadeVisual/foto-sem-fundo.png sobre fundo branco puro (#FFFFFF).
// Elimina qualquer diferença de branco ou textura, garantindo uniformidade perfeita.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pwaIconsDir = join(root, "public", "pwa", "icons");
const brandDir = join(root, "public", "brand");

mkdirSync(pwaIconsDir, { recursive: true });
mkdirSync(brandDir, { recursive: true });

// --- PNG CRC & Chunk Utilities ---
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Decodificador PNG RGBA/RGB
function decodePng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
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
    } else if (type === "IEND") {
      break;
    }
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
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
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

// Codificador PNG RGBA 8-bit
function encodePngRgba(width, height, getPixel) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0; // Filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const dst = rowOffset + 1 + x * 4;
      raw[dst] = r;
      raw[dst + 1] = g;
      raw[dst + 2] = b;
      raw[dst + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 6; // RGBA
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Codificador simples de arquivo ICO a partir de buffers PNG
function encodeIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo 1 = ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let offset = 6 + count * 16;

  for (const { width, height, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((p) => p.buffer)]);
}

// Imagem base transparente oficial
const transparentImagePath = join(root, "identidadeVisual", "foto-sem-fundo.png");
const sourceTransparent = decodePng(readFileSync(transparentImagePath));

console.log(`Carregada imagem transparente: ${sourceTransparent.width}x${sourceTransparent.height}`);

// Limpeza de qualquer halo residual (fringe) nas bordas transparentes
for (let y = 0; y < sourceTransparent.height; y++) {
  for (let x = 0; x < sourceTransparent.width; x++) {
    const idx = (y * sourceTransparent.width + x) * 4;
    const a = sourceTransparent.data[idx + 3];
    const r = sourceTransparent.data[idx];
    const g = sourceTransparent.data[idx + 1];
    const b = sourceTransparent.data[idx + 2];

    // Se for pixel semi-transparente muito claro na borda, ajusta o alpha para transição limpa
    if (a < 50 && (r > 220 || g > 220 || b > 220)) {
      sourceTransparent.data[idx + 3] = 0;
    }
  }
}

// Bounding box exata do conteúdo
let minX = sourceTransparent.width, maxX = 0, minY = sourceTransparent.height, maxY = 0;
for (let y = 0; y < sourceTransparent.height; y++) {
  for (let x = 0; x < sourceTransparent.width; x++) {
    const idx = (y * sourceTransparent.width + x) * 4;
    const a = sourceTransparent.data[idx + 3];
    if (a > 15) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const w = maxX - minX + 1;
const h = maxY - minY + 1;
const bbox = { minX, maxX, minY, maxY, w, h, cx: minX + w / 2, cy: minY + h / 2, maxDim: Math.max(w, h) };

console.log(`Bounding box: ${w}x${h} centralizada em (${bbox.cx.toFixed(1)}, ${bbox.cy.toFixed(1)})`);

// Amostragem bilinear de alta precisão
function sampleImage(normX, normY) {
  const srcX = bbox.cx + normX * bbox.maxDim;
  const srcY = bbox.cy + normY * bbox.maxDim;

  if (srcX < 0 || srcX >= sourceTransparent.width - 1 || srcY < 0 || srcY >= sourceTransparent.height - 1) {
    return [0, 0, 0, 0];
  }

  const x0 = Math.floor(srcX);
  const y0 = Math.floor(srcY);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = srcX - x0;
  const fy = srcY - y0;

  const idx00 = (y0 * sourceTransparent.width + x0) * 4;
  const idx10 = (y0 * sourceTransparent.width + x1) * 4;
  const idx01 = (y1 * sourceTransparent.width + x0) * 4;
  const idx11 = (y1 * sourceTransparent.width + x1) * 4;

  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = sourceTransparent.data[idx00 + c];
    const v10 = sourceTransparent.data[idx10 + c];
    const v01 = sourceTransparent.data[idx01 + c];
    const v11 = sourceTransparent.data[idx11 + c];

    const vTop = v00 * (1 - fx) + v10 * fx;
    const vBottom = v01 * (1 - fx) + v11 * fx;
    out[c] = Math.round(vTop * (1 - fy) + vBottom * fy);
  }
  return out;
}

// 1. Renderiza ícones PWA com composição direta sobre fundo 100% branco (#FFFFFF puro e uniforme)
function renderPwaWhiteIcon(size, scale = 0.90) {
  return encodePngRgba(size, size, (x, y) => {
    const normX = ((x + 0.5) / size - 0.5) / scale;
    const normY = ((y + 0.5) / size - 0.5) / scale;

    const [r, g, b, a] = sampleImage(normX, normY);
    if (a <= 0) return [255, 255, 255, 255]; // Branco puro

    const alphaNorm = a / 255;
    const outR = Math.round(r * alphaNorm + 255 * (1 - alphaNorm));
    const outG = Math.round(g * alphaNorm + 255 * (1 - alphaNorm));
    const outB = Math.round(b * alphaNorm + 255 * (1 - alphaNorm));

    return [outR, outG, outB, 255];
  });
}

// 2. Renderiza assets transparentes (brand logos)
function renderTransparentIcon(size, scale = 0.96) {
  return encodePngRgba(size, size, (x, y) => {
    const normX = ((x + 0.5) / size - 0.5) / scale;
    const normY = ((y + 0.5) / size - 0.5) / scale;

    return sampleImage(normX, normY);
  });
}

// Gera Ícones PWA (composição em fundo 100% branco #FFFFFF uniforme, sem qualquer textura ou diferença de tom)
const pwaTargets = [
  { name: "icon-192.png", size: 192, scale: 0.90 },
  { name: "icon-512.png", size: 512, scale: 0.90 },
  { name: "maskable-512.png", size: 512, scale: 0.72 }, // 80% safe zone
  { name: "apple-touch-icon-180.png", size: 180, scale: 0.88 },
];

for (const { name, size, scale } of pwaTargets) {
  const buf = renderPwaWhiteIcon(size, scale);
  writeFileSync(join(pwaIconsDir, name), buf);
  console.log(`✓ public/pwa/icons/${name} (${size}x${size}, fundo 100% branco uniforme #FFFFFF)`);
}

// Gera Assets transparentes da marca (`public/brand/`)
const brandSizes = [
  { name: "logo.png", size: 512, scale: 0.96 },
  { name: "logo-192.png", size: 192, scale: 0.96 },
  { name: "logo-128.png", size: 128, scale: 0.96 },
  { name: "logo-64.png", size: 64, scale: 0.96 },
  { name: "logo-32.png", size: 32, scale: 0.94 },
  { name: "favicon-32.png", size: 32, scale: 0.94 },
  { name: "favicon-16.png", size: 16, scale: 0.92 },
];

for (const { name, size, scale } of brandSizes) {
  const buf = renderTransparentIcon(size, scale);
  writeFileSync(join(brandDir, name), buf);
  console.log(`✓ public/brand/${name} (${size}x${size} transparente)`);
}

// Favicons ICO
const fav16 = renderTransparentIcon(16, 0.92);
const fav32 = renderTransparentIcon(32, 0.94);
const fav48 = renderTransparentIcon(48, 0.94);

const icoBuf = encodeIco([
  { width: 16, height: 16, buffer: fav16 },
  { width: 32, height: 32, buffer: fav32 },
  { width: 48, height: 48, buffer: fav48 },
]);
writeFileSync(join(root, "public", "favicon.ico"), icoBuf);
console.log(`✓ public/favicon.ico (multi-res 16, 32, 48)`);

// Lockup horizontal completo
const fullLockupPath = join(root, "identidadeVisual", "Gemini_Generated_Image_ru6ti5ru6ti5ru6t (1).png");
if (existsSync(fullLockupPath)) {
  writeFileSync(join(brandDir, "logo-full.png"), readFileSync(fullLockupPath));
  console.log(`✓ public/brand/logo-full.png (lockup horizontal com tipografia)`);
}

console.log("Todos os assets da marca foram gerados com sucesso!");
