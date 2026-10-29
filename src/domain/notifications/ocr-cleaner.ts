/**
 * Utilitário puro de limpeza e normalização óptica de textos brutos de OCR.
 *
 * Corrige ruídos recorrentes de digitalização, scanners e fotos de baixa nitidez:
 * - Troca de letras e dígitos em valores monetários (ex.: 'O'/'o' por '0', 'l'/'I' por '1').
 * - Troca de letras em datas brasileiras (ex.: 'l0/05/2O26' -> '10/05/2026').
 * - Troca de letras em sequências de CNPJ/CPF (ex.: '/OOO1-' -> '/0001-').
 * - Normalização de quebras de linha e separadores de campos.
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou React.
 */

/**
 * Remove caracteres de controle invisíveis sem utilizar regex com escapes de controle ASCII.
 */
function stripControlCharacters(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Preserva tabulação (9), quebras de linha (10 e 13) e caracteres legíveis (>= 32 e != 127)
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) {
      out += text[i];
    }
  }
  return out;
}

/**
 * Normaliza ruídos comuns de OCR em valores monetários brasileiros precedidos por R$ ou RS.
 */
function fixMonetaryOcrArtifacts(text: string): string {
  // 1. Corrige variações de prefixo R$ (ex: "RS ", "R$: ", "R$  ")
  let result = text.replace(/\b(?:RS|R\$)\s*[:=]?\s*/gi, "R$ ");

  // 2. Corrige dígitos em valores precedidos por R$: 'O'/'o' por '0', 'l'/'I' por '1'
  result = result.replace(
    /(R\$\s*)([0-9OolI.,\s]+)/gi,
    (_fullMatch, prefix: string, numberPart: string) => {
      // Substitui caracteres ópticos óbvios dentro do bloco numérico
      const cleanedPart = numberPart
        .replace(/[Oo]/g, "0")
        .replace(/[lI]/g, "1")
        // Remove espaços internos anômalos entre dígitos: "1 50,00" -> "150,00"
        .replace(/(?<=\d)\s+(?=\d)/g, "");

      return `${prefix}${cleanedPart}`;
    },
  );

  return result;
}

/**
 * Normaliza ruídos comuns de OCR em datas brasileiras (DD/MM/AAAA ou DD-MM-AAAA).
 */
function fixDateOcrArtifacts(text: string): string {
  // Procura padrões com barras ou traços contendo números misturados a O ou l
  return text.replace(
    /\b([0-9OolI]{1,2})[/.-]([0-9OolI]{1,2})[/.-]([0-9OolI]{2,4})\b/g,
    (_match, day: string, month: string, year: string) => {
      const cleanDay = day.replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
      const cleanMonth = month.replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
      let cleanYear = year.replace(/[Oo]/g, "0").replace(/[lI]/g, "1");

      if (cleanYear.length === 2) {
        cleanYear = `20${cleanYear}`;
      }

      const dNum = parseInt(cleanDay, 10);
      const mNum = parseInt(cleanMonth, 10);

      if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12) {
        const paddedDay = cleanDay.padStart(2, "0");
        const paddedMonth = cleanMonth.padStart(2, "0");
        return `${paddedDay}/${paddedMonth}/${cleanYear}`;
      }

      return _match;
    },
  );
}

/**
 * Normaliza ruídos comuns de OCR em sequências de CNPJ ou CPF.
 */
function fixTaxIdOcrArtifacts(text: string): string {
  // Corrige 'O' em ramal /0001- ou dígitos de CNPJ formatado
  return text.replace(
    /(?:CNPJ|CPF|CPF\/CNPJ)[\s:.-]*([0-9OolI./-]+)/gi,
    (_match, docStr: string) => {
      const cleaned = docStr.replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
      return `CNPJ/CPF: ${cleaned}`;
    },
  );
}

/**
 * Limpa, normaliza e repara o texto bruto obtido de leitores OCR (Tesseract / ML Kit).
 */
export function cleanOcrText(rawText: string): string {
  if (!rawText || typeof rawText !== "string") {
    return "";
  }

  // 1. Remove caracteres de controle nulos e invisíveis de digitalização
  let text = stripControlCharacters(rawText)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove múltiplos espaços horizontais repetidos
    .replace(/[ \t]+/g, " ");

  // 2. Corrige ruídos monetários, datas e documentos
  text = fixMonetaryOcrArtifacts(text);
  text = fixDateOcrArtifacts(text);
  text = fixTaxIdOcrArtifacts(text);

  // 3. Compacta linhas vazias excessivas (> 2 linhas viram 1 linha em branco)
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}
