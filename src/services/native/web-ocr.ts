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
 * Pré-processa a imagem no navegador via <canvas> antes de enviar ao Tesseract:
 * - Redimensiona suavemente imagens com dimensão > 2500px, acelerando o OCR sem perda de nitidez.
 * - Converte os pixels para escala de cinza (grayscale).
 * - Calcula histograma e aplica binarização adaptativa pelo método de Otsu para isolar caracteres térmicos.
 */
export async function preprocessImageForOcr(file: File | Blob): Promise<Blob | File> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  try {
    let bitmapWidth = 0;
    let bitmapHeight = 0;
    let sourceDrawable: CanvasImageSource | null = null;
    let closeBitmap: (() => void) | null = null;

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
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao carregar imagem"));
        img.src = url;
      });
      URL.revokeObjectURL(url);
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
      closeBitmap?.();
      return file;
    }

    ctx.drawImage(sourceDrawable, 0, 0, targetWidth, targetHeight);
    closeBitmap?.();

    // Conversão para Grayscale e Binarização Adaptativa (Otsu)
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imageData.data;
    const totalPixels = targetWidth * targetHeight;
    const histogram = new Array<number>(256).fill(0);
    const grays = new Uint8Array(totalPixels);

    // Passo 1: Construção do histograma de luminância em escala de cinza
    let pixelIdx = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      // Luminância padronizada NTSC / ITU-R BT.601
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      grays[pixelIdx] = gray;
      histogram[gray] = (histogram[gray] ?? 0) + 1;
      pixelIdx++;
    }

    // Passo 2: Cálculo do limiar ideal por Otsu
    const otsuThreshold = calculateOtsuThreshold(histogram, totalPixels);

    // Passo 3: Aplicação de binarização com realce para leitura óptica
    pixelIdx = 0;
    for (let i = 0; i < data.length; i += 4) {
      const gray = grays[pixelIdx]!;
      // Pixels mais escuros que o limiar viram texto escuro (0), mais claros viram fundo branco (255)
      const binary = gray < otsuThreshold ? 0 : 255;

      data[i] = binary;
      data[i + 1] = binary;
      data[i + 2] = binary;
      pixelIdx++;
    }

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
  }
}

export async function extractTextFromImageWeb(file: File | Blob): Promise<string> {
  const workerHolder: { current: TerminableWorker | null } = { current: null };

  try {
    const processedFile = await preprocessImageForOcr(file);

    const ocrPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const tesseractWorker = await createWorker("por");
      workerHolder.current = tesseractWorker;

      const ret = await tesseractWorker.recognize(processedFile);
      return ret?.data?.text ?? "";
    })();

    // Timeout de segurança para evitar travamento em dispositivos móveis com baixa CPU
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(
        () => reject(new Error("Tempo limite de leitura óptica excedido")),
        OCR_TIMEOUT_MS,
      ),
    );

    const text = await Promise.race([ocrPromise, timeoutPromise]);
    return text.trim();
  } catch {
    // Log silencioso com fallback
    return "";
  } finally {
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
