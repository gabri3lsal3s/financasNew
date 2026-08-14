// Gera ícones PWA da marca "Guia Financeiro" (F10): fundo Azul Petróleo,
// moeda Teal Petróleo com vazado claro e órbita em Ouro Âmbar (carteira
// orbital). Sem dependências — PNG codificado à mão.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "pwa", "icons");
mkdirSync(outDir, { recursive: true });

// --- PNG encoder mínimo (RGB 8-bit, filtro None) ---
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

function encodePng(size, rgbFn) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filtro None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = rgbFn(x, y, size);
      const i = y * stride + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Paleta da marca (identidade "Guia Financeiro" — F10) ---
const PETROLEUM = [20, 37, 49]; // #142531 — fundo
const TEAL = [42, 157, 143]; // #2A9D8F — moeda
const OFF_WHITE = [244, 247, 249]; // #F4F7F9 — vazado central
const GOLD = [221, 167, 38]; // #DDA726 — órbita

const ROT = (24 * Math.PI) / 180;
const COS = Math.cos(ROT);
const SIN = Math.sin(ROT);

/**
 * Carteira orbital: moeda teal com vazado claro + órbita dourada inclinada.
 * `scale` dimensiona o conteúdo (maskable usa a zona segura de 80%).
 */
function brandMark(x, y, s, scale) {
  const cx = s / 2;
  const cy = s / 2;
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;

  // Satélite dourado no topo da órbita (checagem antes do anel p/ prioridade).
  const satX = 0;
  const satY = -0.21 * s * scale;
  const satR = 0.065 * s * scale;

  // Moeda (no espaço da tela, sem rotação).
  const coinR = 0.26 * s * scale;
  const holeR = 0.10 * s * scale;

  // Órbita: transforma o pixel para o referencial da elipse (rotação +24°).
  const ex = dx * COS - dy * SIN;
  const ey = dx * SIN + dy * COS;
  const rx = 0.42 * s * scale;
  const ry = 0.21 * s * scale;
  const t = (ex / rx) ** 2 + (ey / ry) ** 2;

  if ((ex - satX) ** 2 + (ey - satY) ** 2 <= satR * satR) return GOLD;
  if (t >= 0.78 && t <= 1.14) return GOLD;
  if (dx * dx + dy * dy <= holeR * holeR) return OFF_WHITE;
  if (dx * dx + dy * dy <= coinR * coinR) return TEAL;
  return PETROLEUM;
}

const targets = [
  ["icon-192.png", 192, 1.0],
  ["icon-512.png", 512, 1.0],
  ["maskable-512.png", 512, 0.72], // zona segura: 80% central
  ["apple-touch-icon-180.png", 180, 1.0],
];

for (const [name, size, scale] of targets) {
  writeFileSync(join(outDir, name), encodePng(size, (x, y) => brandMark(x, y, size, scale)));
  console.log(`✓ ${name} (${size}x${size}, conteúdo ${Math.round(scale * 100)}%)`);
}

console.log("Ícones PWA da marca 'Guia Financeiro' gerados em public/pwa/icons/");
