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
 * Pré-processa a imagem no navegador via <canvas> antes de enviar ao Tesseract:
 * - Redimensiona suavemente imagens com dimensão > 2500px, acelerando o OCR sem perda de nitidez.
 * - Converte os pixels para escala de cinza (grayscale).
 * - Aplica realce de contraste para destacar caracteres impressos em papel térmico.
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

    // Conversão para Grayscale e Realce de Contraste
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imageData.data;
    const contrast = 30; // Realce moderado de contraste
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;

      // Luminância NTSC / sRGB
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

      data[i] = adjusted;
      data[i + 1] = adjusted;
      data[i + 2] = adjusted;
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
