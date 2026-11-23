/**
 * Módulo de OCR Web puro no cliente utilizando Tesseract.js sob demanda.
 *
 * Utiliza dynamic import para garantir que a biblioteca Tesseract.js não seja incluída
 * no bundle inicial da aplicação, mantendo o PWA extremamente leve.
 *
 * Executado exclusivamente em navegadores (Web/PWA) quando o usuário seleciona uma imagem
 * ou tira foto pela câmera. Em Android nativo, a delegação ocorre para o ML Kit.
 */

const OCR_TIMEOUT_MS = 12000;

interface TerminableWorker {
  terminate: () => Promise<unknown>;
}

export type OcrPreprocessStrategy =
  | "dark_mode_invert_grayscale"
  | "digital_screenshot_grayscale"
  | "thermal_otsu_binarize";

export interface OcrImageProfile {
  meanGray: number;
  modeGray: number;
  modeConcentration: number;
  isDarkMode: boolean;
  isDigitalScreenshot: boolean;
  strategy: OcrPreprocessStrategy;
}

/**
 * Calcula o limiar ótimo de binarização pelo método de Otsu a partir do histograma de luminância.
 * Função pura e determinística.
 */
export function calculateOtsuThreshold(histogram: number[], totalPixels: number): number {
  if (totalPixels <= 0 || histogram.length < 256) {
    return 128;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * (histogram[i] ?? 0);
  }

  let sumB = 0;
  let weightBackground = 0;
  let maximumVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    const count = histogram[t] ?? 0;
    weightBackground += count;
    if (weightBackground === 0) continue;

    const weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) break;

    sumB += t * count;
    const meanBackground = sumB / weightBackground;
    const meanForeground = (sum - sumB) / weightForeground;

    const diff = meanBackground - meanForeground;
    const betweenClassVariance = weightBackground * weightForeground * diff * diff;

    if (betweenClassVariance > maximumVariance) {
      maximumVariance = betweenClassVariance;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Classifica o perfil de luminância de uma imagem para selecionar a melhor estratégia de pré-processamento OCR:
 * - Prints em Dark Mode (`meanGray < 110`): inversão suave sem binarização dura (preserva anti-aliasing).
 * - Prints digitais em Modo Claro: escala de cinza suave sem binarização de Otsu (preserva fontes finas).
 * - Fotos de cupons térmicos / câmera: binarização adaptativa por Otsu para remover sombras do papel.
 */
export function classifyOcrImageProfile(histogram: number[], totalPixels: number): OcrImageProfile {
  if (totalPixels <= 0 || histogram.length < 256) {
    return {
      meanGray: 255,
      modeGray: 255,
      modeConcentration: 0,
      isDarkMode: false,
      isDigitalScreenshot: false,
      strategy: "thermal_otsu_binarize",
    };
  }

  let weightedSum = 0;
  let modeGray = 0;
  let modeCount = -1;

  for (let i = 0; i < 256; i++) {
    const count = histogram[i] ?? 0;
    weightedSum += i * count;
    if (count > modeCount) {
      modeCount = count;
      modeGray = i;
    }
  }

  const meanGray = weightedSum / totalPixels;

  let bandCount = 0;
  const minBand = Math.max(0, modeGray - 4);
  const maxBand = Math.min(255, modeGray + 4);
  for (let i = minBand; i <= maxBand; i++) {
    bandCount += histogram[i] ?? 0;
  }
  const modeConcentration = bandCount / totalPixels;

  const isDarkMode = meanGray < 110;
  const isDigitalScreenshot =
    (modeConcentration >= 0.5 && (modeGray >= 230 || modeGray <= 45)) ||
    (modeConcentration >= 0.6 && (modeGray >= 200 || modeGray <= 70));

  const strategy: OcrPreprocessStrategy = isDarkMode
    ? "dark_mode_invert_grayscale"
    : isDigitalScreenshot
      ? "digital_screenshot_grayscale"
      : "thermal_otsu_binarize";

  return {
    meanGray,
    modeGray,
    modeConcentration,
    isDarkMode,
    isDigitalScreenshot,
    strategy,
  };
}

function getHistogramPercentile(histogram: number[], totalPixels: number, quantile: number): number {
  const target = totalPixels * quantile;
  let cumulative = 0;
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i] ?? 0;
    if (cumulative >= target) {
      return i;
    }
  }
  return 255;
}

/**
 * Aplica pré-processamento adaptativo diretamente no buffer RGBA de um <canvas>.
 * Função determinística testável em jsdom sem depender de Tesseract ativo.
 */
export function applyOcrPixelPreprocess(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): OcrImageProfile {
  const totalPixels = Math.max(0, Math.min(width * height, Math.floor(data.length / 4)));
  const histogram = new Array<number>(256).fill(0);
  const grays = new Uint8Array(totalPixels);

  let pixelIdx = 0;
  for (let i = 0; pixelIdx < totalPixels; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    grays[pixelIdx] = gray;
    histogram[gray] = (histogram[gray] ?? 0) + 1;
    pixelIdx++;
  }

  const profile = classifyOcrImageProfile(histogram, totalPixels);

  if (profile.strategy === "dark_mode_invert_grayscale") {
    const lowGray = getHistogramPercentile(histogram, totalPixels, 0.005);
    const highGray = getHistogramPercentile(histogram, totalPixels, 0.995);
    const invLow = 255 - highGray;
    const invHigh = 255 - lowGray;
    const span = invHigh - invLow;
    const shouldStretch = span >= 30 && span < 230;

    pixelIdx = 0;
    for (let i = 0; pixelIdx < totalPixels; i += 4) {
      const inverted = 255 - grays[pixelIdx]!;
      const out = shouldStretch
        ? Math.max(0, Math.min(255, Math.round(((inverted - invLow) * 255) / span)))
        : inverted;
      data[i] = out;
      data[i + 1] = out;
      data[i + 2] = out;
      pixelIdx++;
    }
    return profile;
  }

  if (profile.strategy === "digital_screenshot_grayscale") {
    const lowGray = getHistogramPercentile(histogram, totalPixels, 0.005);
    const highGray = getHistogramPercentile(histogram, totalPixels, 0.995);
    const span = highGray - lowGray;
    const shouldStretch = span >= 30 && span < 230;

    pixelIdx = 0;
    for (let i = 0; pixelIdx < totalPixels; i += 4) {
      const gray = grays[pixelIdx]!;
      const out = shouldStretch
        ? Math.max(0, Math.min(255, Math.round(((gray - lowGray) * 255) / span)))
        : gray;
      data[i] = out;
      data[i + 1] = out;
      data[i + 2] = out;
      pixelIdx++;
    }
    return profile;
  }

  // Fotos térmicas / documentos fotografados com variação de luz -> Otsu clássico
  const otsuThreshold = calculateOtsuThreshold(histogram, totalPixels);
  pixelIdx = 0;
  for (let i = 0; pixelIdx < totalPixels; i += 4) {
    const binary = grays[pixelIdx]! < otsuThreshold ? 0 : 255;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
    pixelIdx++;
  }

  return profile;
}

/**
 * Pré-processa a imagem no navegador via <canvas> antes de enviar ao Tesseract:
 * - Redimensiona suavemente imagens com dimensão > 2500px, acelerando o OCR sem perda de nitidez.
 * - Detecta Dark Mode / prints digitais para preservar anti-aliasing sem binarização destrutiva.
 * - Aplica Otsu somente em fotos físicas / cupons térmicos.
 */
export async function preprocessImageForOcr(file: File | Blob): Promise<Blob | File> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  let createdUrl: string | null = null;
  let closeBitmap: (() => void) | null = null;

  try {
    let bitmapWidth = 0;
    let bitmapHeight = 0;
    let sourceDrawable: CanvasImageSource | null = null;

    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        bitmapWidth = bitmap.width;
        bitmapHeight = bitmap.height;
        sourceDrawable = bitmap;
        closeBitmap = () => bitmap.close();
      } catch {
        // Fallback para Image element caso createImageBitmap falhe com o tipo de Blob
      }
    }

    if (!sourceDrawable) {
      createdUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao carregar imagem"));
        img.src = createdUrl!;
      });
      bitmapWidth = img.naturalWidth || img.width;
      bitmapHeight = img.naturalHeight || img.height;
      sourceDrawable = img;
    }

    if (!sourceDrawable || bitmapWidth <= 0 || bitmapHeight <= 0) {
      return file;
    }

    // Redimensionamento suave se largura ou altura ultrapassarem 2500px
    const maxDim = 2500;
    let targetWidth = bitmapWidth;
    let targetHeight = bitmapHeight;

    if (targetWidth > maxDim || targetHeight > maxDim) {
      const scale = maxDim / Math.max(targetWidth, targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return file;
    }

    ctx.drawImage(sourceDrawable, 0, 0, targetWidth, targetHeight);

    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    applyOcrPixelPreprocess(imageData.data, targetWidth, targetHeight);
    ctx.putImageData(imageData, 0, 0);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob || file);
        },
        "image/png",
      );
    });
  } catch {
    return file;
  } finally {
    closeBitmap?.();
    if (createdUrl) {
      try {
        URL.revokeObjectURL(createdUrl);
      } catch {
        // no-op
      }
    }
  }
}

export async function extractTextFromImageWeb(file: File | Blob): Promise<string> {
  // 1. Em ambientes sem suporte nativo a Web Worker (Node, SSR, jsdom) ou
  // em navegadores estritos como Firefox (onde a criação de Web Workers inline via Blob URL
  // com scripts externos dispara SecurityError na engine Gecko), retorna string vazia
  // imediatamente para acionar o Gemini Vision multimodal sem atrito nem ruído no console.
  if (
    typeof window === "undefined" ||
    typeof Worker === "undefined" ||
    (typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent))
  ) {
    return "";
  }

  const workerHolder: { current: TerminableWorker | null } = { current: null };
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  // Supressores de segurança para interceptar e prevenir que erros não tratados de workers vazem para a window
  const suppressWorkerSecurityError = (event: ErrorEvent) => {
    const msg = String(event.message || "");
    if (
      msg.includes("insecure") ||
      msg.includes("SecurityError") ||
      event.error?.name === "SecurityError"
    ) {
      event.preventDefault?.();
    }
  };
  const suppressUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || "");
    if (
      msg.includes("insecure") ||
      msg.includes("SecurityError") ||
      reason?.name === "SecurityError"
    ) {
      event.preventDefault?.();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("error", suppressWorkerSecurityError);
    window.addEventListener("unhandledrejection", suppressUnhandledRejection);
  }

  try {
    const processedFile = await preprocessImageForOcr(file);

    const ocrPromise = (async () => {
      try {
        const { createWorker } = await import("tesseract.js");
        // OEM 1 (LSTM_ONLY) com errorHandler explícito evita uncaught rejection quando worker falha/expira
        const tesseractWorker = await createWorker("por", 1, {
          errorHandler: () => {},
        });
        workerHolder.current = tesseractWorker;

        const ret = await tesseractWorker.recognize(processedFile);
        return ret?.data?.text ?? "";
      } catch {
        return "";
      }
    })();

    // Evita Uncaught (in promise) caso timeout ou worker encerre antes da promise rejeitar
    void ocrPromise.catch(() => "");

    // Timeout de segurança para evitar travamento em dispositivos móveis com baixa CPU
    const timeoutPromise = new Promise<string>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Tempo limite de leitura óptica excedido")),
        OCR_TIMEOUT_MS,
      );
    });

    const text = await Promise.race([ocrPromise, timeoutPromise]);
    return text.trim();
  } catch {
    // Log silencioso com fallback
    return "";
  } finally {
    if (typeof window !== "undefined") {
      window.removeEventListener("error", suppressWorkerSecurityError);
      window.removeEventListener("unhandledrejection", suppressUnhandledRejection);
    }
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    const active = workerHolder.current;
    if (active) {
      try {
        await active.terminate();
      } catch {
        // Ignora erro no encerramento
      }
    }
  }
}
