/**
 * Utilitário puro de limpeza e normalização óptica de textos brutos de OCR.
 *
 * Corrige ruídos recorrentes de digitalização, scanners e fotos de baixa nitidez:
 * - Prefixos monetários danificados: B$, RS, P$, A$, h$, F$, 8$, k$ -> R$.
 * - Valores monetários fraturados por espaçamento: "1. 250, 00" -> "1.250,00" e "45 , 90" -> "45,90".
 * - Pontuações acidentais em centavos: apóstrofos e traços ("42'90", "42-90", "42 90") -> "42,90".
 * - Linhas decorativas e bordas pontilhadas (- - - -, * * * *, =======).
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
 * Remove ruídos de linhas decorativas e bordas pontilhadas típicas de cupons fiscais térmicos
 * (- - - - -, * * * * *, ====================, _ _ _ _ _).
 */
function removeDecorativeNoiseLines(text: string): string {
  const lines = text.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // preserva linhas vazias estruturais
    // Se a linha for composta exclusivamente por 3 ou mais caracteres decorativos e espaços
    const isDecorative = /^(?:[\s\-_*=.~#•·])*(?:[-*=_~#•·]\s*){3,}$/.test(trimmed);
    return !isDecorative;
  });
  return filtered.join("\n");
}

/**
 * Converte prefixos monetários danificados por falhas ópticas (B$, RS, P$, A$, h$, F$, 8$, k$) para R$.
 */
function fixDamagedCurrencyPrefixes(text: string): string {
  // Converte prefixos danificados em R$ quando precedidos por início de linha, espaço ou pontuação
  // (evita transformar moedas como US$) e seguidos por valor monetário
  let result = text.replace(
    /(^|[^a-zA-Z0-9$])([BPAhF8k]|RS|R)\$\s*[:=]?\s*(?=[0-9OolI])/gi,
    "$1R$ ",
  );

  // Também trata "RS " ou "RS: " sem cifrão quando seguido por dígitos
  result = result.replace(
    /\bRS\s*[:=]?\s*(?=[0-9OolI])/gi,
    "R$ ",
  );

  return result;
}

/**
 * Repara valores fraturados por espaçamento irregular do OCR:
 * "1. 250, 00" -> "1.250,00", "45 , 90" -> "45,90", "1 . 250 , 00" -> "1.250,00", "1 50,00" -> "150,00".
 */
function fixFracturedMonetaryAmounts(text: string): string {
  let result = text;

  // 1. Espaços ao redor do separador de milhar ponto: "1 . 250" ou "1. 250" ou "1 .250"
  result = result.replace(/(?<=\b\d{1,3})\s*\.\s*(?=\d{3}\b)/g, ".");

  // 2. Espaços ao redor da vírgula decimal: "45 , 90" ou "45, 90" ou "45 ,90"
  result = result.replace(/(?<=\b\d{1,6})\s*,\s*(?=\d{2}\b)/g, ",");

  // 3. Espaços internos anômalos entre dígitos que possuem decimais: "1 50,00" -> "150,00"
  result = result.replace(/(?<=\b\d{1,4})\s+(?=\d+(?:[.,]\d{2}))/g, "");

  // 4. Espaços internos anômalos em números monetários precedidos por R$:
  // Ex: "R$ 1 250,00" -> "R$ 1250,00"
  result = result.replace(/(R\$\s*\d{1,3})\s+(\d{3}(?:[.,]\d{2})?)/g, "$1$2");

  return result;
}

/**
 * Corrige pontuações acidentais em centavos causadas por sujeira na fita térmica:
 * "42'90" -> "42,90", "42-90" -> "42,90", "R$ 42 90" -> "R$ 42,90".
 */
function fixCentPunctuationArtifacts(text: string): string {
  let result = text;

  // 1. Apóstrofo separando centavos: "42'90" ou "1.250'50"
  result = result.replace(
    /(R\$\s*\d{1,3}(?:\.\d{3})*|\b\d{1,6})'(\d{2})(?![.,\d])\b/g,
    "$1,$2",
  );

  // 2. Traço acidental separando centavos estritamente precedido por R$: "R$ 42-90"
  result = result.replace(
    /(R\$\s*\d{1,3}(?:\.\d{3})*)-(\d{2})(?![.,\d])\b/g,
    "$1,$2",
  );

  // 3. Espaço isolado separando centavos após R$: "R$ 42 90" -> "R$ 42,90"
  result = result.replace(
    /(R\$\s*\d{1,3}(?:\.\d{3})*)\s+(\d{2})(?![.,\d])\b/gi,
    "$1,$2",
  );

  return result;
}

/**
 * Normaliza ruídos comuns de OCR em valores monetários brasileiros precedidos por R$.
 */
function fixMonetaryOcrArtifacts(text: string): string {
  // Corrige dígitos em valores precedidos por R$: 'O'/'o' por '0', 'l'/'I' por '1'
  return text.replace(
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
    /(?:CNPJ|CPF|CPF\/CNPJ|CNPJ\/CPF)[\s:.-]*([0-9OolI./-]+)/gi,
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

  // 2. Remove ruídos de linhas decorativas e bordas pontilhadas
  text = removeDecorativeNoiseLines(text);

  // 3. Corrige prefixos monetários danificados (B$, RS, P$, A$, h$, F$, 8$, k$ -> R$)
  text = fixDamagedCurrencyPrefixes(text);

  // 4. Corrige valores fraturados por espaçamento irregular (1. 250, 00 -> 1.250,00)
  text = fixFracturedMonetaryAmounts(text);

  // 5. Corrige pontuações acidentais em centavos (42'90, 42-90, 42 90 -> 42,90)
  text = fixCentPunctuationArtifacts(text);

  // 6. Corrige substituições ópticas de dígitos e letras em valores monetários (O/o -> 0, l/I -> 1)
  text = fixMonetaryOcrArtifacts(text);

  // 7. Corrige ruídos em datas brasileiras
  text = fixDateOcrArtifacts(text);

  // 8. Corrige ruídos em sequências de CNPJ/CPF
  text = fixTaxIdOcrArtifacts(text);

  // 9. Compacta linhas vazias excessivas (> 2 linhas viram 1 linha em branco)
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}
