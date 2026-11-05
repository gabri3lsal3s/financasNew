/**
 * Motor de geracao de QR Code para Pix Copia e Cola / BR Code (Client-Side).
 *
 * Utiliza o encoder universal leve uqr (zero-dependencies), convertendo o payload
 * em matriz booleana 2D, renderizacao SVG nativa e projecao em HTML5 Canvas.
 */

import { encode, renderSVG } from "uqr";

export type QrCodeEccLevel = "L" | "M" | "Q" | "H";

export interface GenerateQrCodeOptions {
  ecc?: QrCodeEccLevel;
  border?: number;
}

export interface DrawQrCodeOptions {
  scale?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Gera uma matriz booleana 2D para o QR code do texto informado.
 * Retorna boolean[][] onde true indica modulo escuro e false modulo claro.
 */
export function generateQrCodeMatrix(
  text: string,
  options?: GenerateQrCodeOptions,
): boolean[][] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const result = encode(trimmed, {
    ecc: options?.ecc ?? "M",
    border: options?.border ?? 0,
  });

  return result.data;
}

/**
 * Renderiza uma string SVG completa contendo o QR Code vetorial.
 */
export function renderQrCodeSvg(
  text: string,
  options?: GenerateQrCodeOptions & { blackColor?: string; whiteColor?: string },
): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  return renderSVG(trimmed, {
    ecc: options?.ecc ?? "M",
    border: options?.border ?? 2,
    blackColor: options?.blackColor ?? "#000000",
    whiteColor: options?.whiteColor ?? "#ffffff",
  });
}

/**
 * Projeta uma matriz de modulos QR diretamente em um elemento HTMLCanvasElement.
 */
export function drawQrMatrixToCanvas(
  canvas: HTMLCanvasElement,
  matrix: boolean[][],
  options?: DrawQrCodeOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const margin = options?.margin ?? 2;
  const darkColor = options?.darkColor ?? "#000000";
  const lightColor = options?.lightColor ?? "#ffffff";

  const size = matrix.length;
  if (size === 0) return;

  const totalModules = size + 2 * margin;
  const scale = options?.scale ?? 4;
  const pixelSize = totalModules * scale;

  canvas.width = pixelSize;
  canvas.height = pixelSize;

  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, pixelSize, pixelSize);

  ctx.fillStyle = darkColor;
  for (let y = 0; y < size; y++) {
    const row = matrix[y];
    if (!row) continue;
    for (let x = 0; x < size; x++) {
      if (row[x]) {
        ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      }
    }
  }
}

/**
 * Atalho para codificar o texto e desenhar o QR code diretamente no canvas client-side.
 */
export function drawQrCodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options?: DrawQrCodeOptions & GenerateQrCodeOptions,
): void {
  const matrix = generateQrCodeMatrix(text, options);
  drawQrMatrixToCanvas(canvas, matrix, options);
}
