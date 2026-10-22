import { isNativePlatform } from "./platform";
import { BankNotificationPlugin } from "./bank-listener";

/**
 * Converte um arquivo do navegador (File ou Blob) em string base64 pura (sem data prefix).
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      if (commaIndex !== -1) {
        resolve(result.slice(commaIndex + 1));
      } else {
        resolve(result);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Extrai texto legível de streams embutidas de um arquivo PDF digital no navegador.
 */
export function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const textDecoder = new TextDecoder("latin1");
  const rawString = textDecoder.decode(bytes);

  const textChunks: string[] = [];

  // 1. Extrai blocos literais entre parênteses em operadores de texto Tj ou TJ
  const tjRegex = /\(([^()]{2,})\)\s*(?:Tj|'|")/g;
  let match: RegExpExecArray | null;

  while ((match = tjRegex.exec(rawString)) !== null) {
    const chunk = match[1]?.trim();
    if (chunk && chunk.length > 1) {
      textChunks.push(chunk);
    }
  }

  // 2. Extrai arrays de texto TJ
  const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(rawString)) !== null) {
    const inner = match[1] || "";
    const innerChunks = inner.match(/\(([^()]+)\)/g);
    if (innerChunks) {
      const line = innerChunks
        .map((c) => c.slice(1, -1))
        .join(" ")
        .trim();
      if (line) {
        textChunks.push(line);
      }
    }
  }

  // 3. Fallback: Procura padrões de texto e números monetários legíveis no arquivo
  if (textChunks.length === 0) {
    const plainMatches = rawString.match(/(?:R\$|Pix|Transfer[eê]ncia|Pagamento|Comprovante)[\s\S]{0,100}/gi);
    if (plainMatches) {
      textChunks.push(...plainMatches.map((m) => m.trim()));
    }
  }

  return textChunks.join("\n");
}

/**
 * Extrai o texto contido em um arquivo de comprovante (PDF ou imagem):
 * - No Android nativo: delega ao ML Kit Text Recognition via Capacitor Plugin (100% offline e sem inchaço de APK).
 * - Na Web / PWA: analisa a estrutura do PDF ou lê arquivos textuais diretamente.
 */
export async function extractReceiptTextFromFile(file: File): Promise<string> {
  if (isNativePlatform()) {
    try {
      const base64Data = await fileToBase64(file);
      const res = await BankNotificationPlugin.extractTextFromReceipt({
        base64Data,
        mimeType: file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
      });
      if (res?.text && res.text.trim().length > 0) {
        return res.text.trim();
      }
    } catch {
      // Fallback para leitura em JS caso o plugin nativo falhe
    }
  }

  // Fallback Web / PWA
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    try {
      const buffer = await file.arrayBuffer();
      const extracted = extractTextFromPdfArrayBuffer(buffer);
      if (extracted.trim().length > 0) {
        return extracted;
      }
    } catch {
      // Ignora erro
    }
  }

  // Se for texto puro
  if (file.type.startsWith("text/")) {
    try {
      return (await file.text()).trim();
    } catch {
      return "";
    }
  }

  return "";
}
