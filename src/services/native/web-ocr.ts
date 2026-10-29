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

export async function extractTextFromImageWeb(file: File | Blob): Promise<string> {
  const workerHolder: { current: TerminableWorker | null } = { current: null };

  try {
    const ocrPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const tesseractWorker = await createWorker("por");
      workerHolder.current = tesseractWorker;

      const ret = await tesseractWorker.recognize(file);
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
