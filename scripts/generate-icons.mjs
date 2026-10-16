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

// Imagens base oficiais da marca ÁXIS:
// - sourceDark: letra 'A' branca (para superfícies escuras como splash screen)
// - sourceLight: letra 'A' escura (para superfícies claras e ícones de launcher com fundo branco)
// - sourceAmberLight: letra 'A' escura e asas âmbar (para ícone do launcher Pro em fundo branco)
const darkPath = existsSync(join(root, "public", "brand", "logo-teal-dark.png"))
  ? join(root, "public", "brand", "logo-teal-dark.png")
  : join(root, "identidadeVisual", "axis-logo.png");
const lightPath = existsSync(join(root, "public", "brand", "logo-teal-light.png"))
  ? join(root, "public", "brand", "logo-teal-light.png")
  : darkPath;
const amberLightPath = existsSync(join(root, "public", "brand", "logo-amber-light.png"))
  ? join(root, "public", "brand", "logo-amber-light.png")
  : lightPath;

const sourceDark = decodePng(readFileSync(darkPath));
const sourceLight = decodePng(readFileSync(lightPath));
const sourceAmberLight = decodePng(readFileSync(amberLightPath));

console.log(`Carregadas imagens base da marca: Dark (${sourceDark.width}x${sourceDark.height}), Light (${sourceLight.width}x${sourceLight.height}) e Amber Light (${sourceAmberLight.width}x${sourceAmberLight.height})`);

function getBbox(source) {
  let minX = source.width, maxX = 0, minY = source.height, maxY = 0;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const idx = (y * source.width + x) * 4;
      const a = source.data[idx + 3];
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
  return { minX, maxX, minY, maxY, w, h, cx: minX + w / 2, cy: minY + h / 2, maxDim: Math.max(w, h) };
}

const bboxDark = getBbox(sourceDark);
const bboxLight = getBbox(sourceLight);
const bboxAmberLight = getBbox(sourceAmberLight);

// Amostragem bilinear de alta precisão
function sampleImage(normX, normY, source, bbox) {
  const srcX = bbox.cx + normX * bbox.maxDim;
  const srcY = bbox.cy + normY * bbox.maxDim;

  if (srcX < 0 || srcX >= source.width - 1 || srcY < 0 || srcY >= source.height - 1) {
    return [0, 0, 0, 0];
  }

  const x0 = Math.floor(srcX);
  const y0 = Math.floor(srcY);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = srcX - x0;
  const fy = srcY - y0;

  const idx00 = (y0 * source.width + x0) * 4;
  const idx10 = (y0 * source.width + x1) * 4;
  const idx01 = (y1 * source.width + x0) * 4;
  const idx11 = (y1 * source.width + x1) * 4;

  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = source.data[idx00 + c];
    const v10 = source.data[idx10 + c];
    const v01 = source.data[idx01 + c];
    const v11 = source.data[idx11 + c];

    const vTop = v00 * (1 - fx) + v10 * fx;
    const vBottom = v01 * (1 - fx) + v11 * fx;
    out[c] = Math.round(vTop * (1 - fy) + vBottom * fy);
  }
  return out;
}

// 1. Renderiza ícones sobre fundo branco (#FFFFFF) utilizando a logo com 'A' escuro (sourceLight)
function renderPwaWhiteIcon(size, scale = 0.80) {
  return encodePngRgba(size, size, (x, y) => {
    const normX = ((x + 0.5) / size - 0.5) / scale;
    const normY = ((y + 0.5) / size - 0.5) / scale;

    const [r, g, b, a] = sampleImage(normX, normY, sourceLight, bboxLight);
    if (a <= 0) return [255, 255, 255, 255]; // Branco puro

    const alphaNorm = a / 255;
    const outR = Math.round(r * alphaNorm + 255 * (1 - alphaNorm));
    const outG = Math.round(g * alphaNorm + 255 * (1 - alphaNorm));
    const outB = Math.round(b * alphaNorm + 255 * (1 - alphaNorm));

    return [outR, outG, outB, 255];
  });
}

// 2. Renderiza assets transparentes (padrão Dark com 'A' branco para propósito geral ou Light se especificado)
function renderTransparentIcon(size, scale = 0.96, useLight = false) {
  const source = useLight ? sourceLight : sourceDark;
  const bbox = useLight ? bboxLight : bboxDark;
  return encodePngRgba(size, size, (x, y) => {
    const normX = ((x + 0.5) / size - 0.5) / scale;
    const normY = ((y + 0.5) / size - 0.5) / scale;

    return sampleImage(normX, normY, source, bbox);
  });
}

// 3. Renderiza ícone Pro Âmbar sobre fundo branco (#FFFFFF) com 'A' escuro e asas âmbar (sourceAmberLight)
function renderPwaWhiteAmberIcon(size, scale = 0.80) {
  return encodePngRgba(size, size, (x, y) => {
    const normX = ((x + 0.5) / size - 0.5) / scale;
    const normY = ((y + 0.5) / size - 0.5) / scale;

    const [r, g, b, a] = sampleImage(normX, normY, sourceAmberLight, bboxAmberLight);
    if (a <= 0) return [255, 255, 255, 255]; // Branco puro

    const alphaNorm = a / 255;
    const outR = Math.round(r * alphaNorm + 255 * (1 - alphaNorm));
    const outG = Math.round(g * alphaNorm + 255 * (1 - alphaNorm));
    const outB = Math.round(b * alphaNorm + 255 * (1 - alphaNorm));

    return [outR, outG, outB, 255];
  });
}

// 4. Renderiza foreground adaptativo transparente Pro Âmbar com 'A' escuro e asas âmbar
function renderTransparentAmberIcon(size, scale = 0.58) {
  return encodePngRgba(size, size, (x, y) => {
    const normX = ((x + 0.5) / size - 0.5) / scale;
    const normY = ((y + 0.5) / size - 0.5) / scale;

    return sampleImage(normX, normY, sourceAmberLight, bboxAmberLight);
  });
}

// Gera Ícones PWA Transparentes (purpose: "any" — padrão icon-only, sem caixa de fundo para dispositivos compatíveis)
const pwaTransparentTargets = [
  { name: "icon-192.png", size: 192, scale: 0.96 },
  { name: "icon-512.png", size: 512, scale: 0.96 },
  { name: "icon-transparent-192.png", size: 192, scale: 0.96 },
  { name: "icon-transparent-512.png", size: 512, scale: 0.96 },
  { name: "pwa-192x192.png", size: 192, scale: 0.96 },
  { name: "pwa-512x512.png", size: 512, scale: 0.96 },
  { name: "apple-touch-icon-180.png", size: 180, scale: 0.94 },
  { name: "apple-touch-icon.png", size: 180, scale: 0.94 },
];

for (const { name, size, scale } of pwaTransparentTargets) {
  const buf = renderTransparentIcon(size, scale);
  writeFileSync(join(pwaIconsDir, name), buf);
  console.log(`✓ public/pwa/icons/${name} (${size}x${size}, fundo 100% transparente — icon-only / purpose: any)`);
}

// Gera Ícones PWA Adaptativos/Mascaráveis (purpose: "maskable" — fundo branco sólido para Android que exige preenchimento)
const pwaMaskableTargets = [
  { name: "maskable-192.png", size: 192, scale: 0.80 },
  { name: "maskable-512.png", size: 512, scale: 0.80 },
  { name: "icon-maskable-192.png", size: 192, scale: 0.80 },
  { name: "icon-maskable-512.png", size: 512, scale: 0.80 },
  { name: "pwa-maskable-192x192.png", size: 192, scale: 0.80 },
  { name: "pwa-maskable-512x512.png", size: 512, scale: 0.80 },
];

for (const { name, size, scale } of pwaMaskableTargets) {
  const buf = renderPwaWhiteIcon(size, scale);
  writeFileSync(join(pwaIconsDir, name), buf);
  console.log(`✓ public/pwa/icons/${name} (${size}x${size}, fundo branco — safe zone 80% / purpose: maskable)`);
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
console.log(`✓ public/favicon.ico (multi-res 16, 32, 48 transparente)`);

// Favicon SVG (mantém o vetor puro SVG de alta fidelidade sem serrilhados)
if (!existsSync(join(root, "public", "favicon.svg"))) {
  const logo512Buf = renderTransparentIcon(512, 0.96);
  const logo512Base64 = logo512Buf.toString("base64");
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
    <image href="data:image/png;base64,${logo512Base64}" width="512" height="512" />
  </svg>\n`;
  writeFileSync(join(root, "public", "favicon.svg"), svgContent, "utf8");
  writeFileSync(join(brandDir, "favicon.svg"), svgContent, "utf8");
}
console.log(`✓ public/favicon.svg & public/brand/favicon.svg (vetor SVG oficial)`);

// Lockup horizontal completo oficial
console.log(`✓ public/brand/logo-full.png (lockup horizontal oficial AXIS • Guia Financeiro)`);

// 5. Gera ícones e Splash Screens do Android Nativo (`android/app/src/main/res/`)
const androidResDir = join(root, "android", "app", "src", "main", "res");
if (existsSync(androidResDir)) {
  const mipmaps = [
    { dir: "mipmap-mdpi", size: 48, fgSize: 108 },
    { dir: "mipmap-hdpi", size: 72, fgSize: 162 },
    { dir: "mipmap-xhdpi", size: 96, fgSize: 216 },
    { dir: "mipmap-xxhdpi", size: 144, fgSize: 324 },
    { dir: "mipmap-xxxhdpi", size: 192, fgSize: 432 },
  ];

  for (const { dir, size, fgSize } of mipmaps) {
    const targetDir = join(androidResDir, dir);
    mkdirSync(targetDir, { recursive: true });

    // (a) ic_launcher.png (legacy icon com fundo branco e respiro balanceado: 0.74)
    const legacyBuf = renderPwaWhiteIcon(size, 0.74);
    writeFileSync(join(targetDir, "ic_launcher.png"), legacyBuf);

    // (b) ic_launcher_round.png (legacy round icon com fundo branco e respiro balanceado: 0.74)
    writeFileSync(join(targetDir, "ic_launcher_round.png"), legacyBuf);

    // (c) ic_launcher_foreground.png (adaptive foreground transparente com 'A' escuro para fundo branco: scale 0.58)
    const fgBuf = renderTransparentIcon(fgSize, 0.58, true);
    writeFileSync(join(targetDir, "ic_launcher_foreground.png"), fgBuf);

    // (d) ic_launcher_pro.png (legacy icon Pro Âmbar com fundo branco: 0.74)
    const proLegacyBuf = renderPwaWhiteAmberIcon(size, 0.74);
    writeFileSync(join(targetDir, "ic_launcher_pro.png"), proLegacyBuf);

    // (e) ic_launcher_pro_round.png (legacy round icon Pro Âmbar com fundo branco: 0.74)
    writeFileSync(join(targetDir, "ic_launcher_pro_round.png"), proLegacyBuf);

    // (f) ic_launcher_pro_foreground.png (adaptive foreground transparente Pro Âmbar: scale 0.58)
    const proFgBuf = renderTransparentAmberIcon(fgSize, 0.58);
    writeFileSync(join(targetDir, "ic_launcher_pro_foreground.png"), proFgBuf);

    console.log(`✓ android/res/${dir} (launcher ${size}x${size}, fg ${fgSize}x${fgSize} [Default + Pro])`);
  }

  // Gera os XMLs do Adaptive Icon para a variante Pro
  const anydpiDir = join(androidResDir, "mipmap-anydpi-v26");
  mkdirSync(anydpiDir, { recursive: true });
  const proXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_pro_foreground"/>
</adaptive-icon>
`;
  writeFileSync(join(anydpiDir, "ic_launcher_pro.xml"), proXmlContent, "utf8");
  writeFileSync(join(anydpiDir, "ic_launcher_pro_round.xml"), proXmlContent, "utf8");
  console.log(`✓ android/res/mipmap-anydpi-v26/ (ic_launcher_pro.xml e ic_launcher_pro_round.xml)`);

  // Remove o vetor padrão de foreground do Capacitor (robô/escudo azul) para que o Android
  // utilize o @mipmap/ic_launcher_foreground real gerado a partir da marca.
  const vectorFgPath = join(androidResDir, "drawable-v24", "ic_launcher_foreground.xml");
  if (existsSync(vectorFgPath)) {
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(vectorFgPath);
      console.log(`✓ Removido vetor residual de foreground: ${vectorFgPath}`);
    } catch {
      // Ignora erro caso o arquivo já não exista ou esteja inacessível
    }
  }

  // Splash Screens Android com a logo oficial centralizada
  const splashDrawables = [
    { dir: "drawable", w: 480, h: 800 },
    { dir: "drawable-port-mdpi", w: 320, h: 480 },
    { dir: "drawable-port-hdpi", w: 480, h: 800 },
    { dir: "drawable-port-xhdpi", w: 720, h: 1280 },
    { dir: "drawable-port-xxhdpi", w: 960, h: 1600 },
    { dir: "drawable-port-xxxhdpi", w: 1280, h: 1920 },
    { dir: "drawable-land-mdpi", w: 480, h: 320 },
    { dir: "drawable-land-hdpi", w: 800, h: 480 },
    { dir: "drawable-land-xhdpi", w: 1280, h: 720 },
    { dir: "drawable-land-xxhdpi", w: 1600, h: 960 },
    { dir: "drawable-land-xxxhdpi", w: 1920, h: 1280 },
  ];

  for (const { dir, w: sw, h: sh } of splashDrawables) {
    const targetDir = join(androidResDir, dir);
    mkdirSync(targetDir, { recursive: true });
    const splashBuf = encodePngRgba(sw, sh, (px, py) => {
      const minDim = Math.min(sw, sh);
      const iconSize = Math.round(minDim * 0.40);
      const offsetX = Math.round((sw - iconSize) / 2);
      const offsetY = Math.round((sh - iconSize) / 2);

      if (px >= offsetX && px < offsetX + iconSize && py >= offsetY && py < offsetY + iconSize) {
        const normX = ((px - offsetX + 0.5) / iconSize - 0.5) / 0.90;
        const normY = ((py - offsetY + 0.5) / iconSize - 0.5) / 0.90;
        const [r, g, b, a] = sampleImage(normX, normY, sourceLight, bboxLight);
        if (a > 0) {
          const alphaNorm = a / 255;
          return [
            Math.round(r * alphaNorm + 244 * (1 - alphaNorm)),
            Math.round(g * alphaNorm + 247 * (1 - alphaNorm)),
            Math.round(b * alphaNorm + 249 * (1 - alphaNorm)),
            255,
          ];
        }
      }
      return [244, 247, 249, 255]; // Fundo #F4F7F9
    });
    writeFileSync(join(targetDir, "splash.png"), splashBuf);
    console.log(`✓ android/res/${dir}/splash.png (${sw}x${sh})`);
  }
}

console.log("Todos os assets da marca, PWA e Android nativo foram gerados com sucesso!");
