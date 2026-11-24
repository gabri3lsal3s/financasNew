import type { BlueprintFileKind, StatementFingerprintResult } from "./types";

const KNOWN_ISSUERS: ReadonlyArray<{
  key: string;
  name: string;
  pattern: RegExp;
}> = [
  { key: "nomad", name: "Nomad", pattern: /\bnomad\b/i },
  { key: "xp", name: "XP", pattern: /\b(?:xp\s+investimentos|cart[aã]o\s+xp|banco\s+xp)\b/i },
  { key: "rico", name: "Rico", pattern: /\b(?:rico\s+investimentos|cart[aã]o\s+rico|banco\s+rico)\b/i },
  { key: "clear", name: "Clear", pattern: /\b(?:clear\s+corretora|cart[aã]o\s+clear)\b/i },
  { key: "nubank", name: "Nubank", pattern: /\b(?:nubank|nu\s+pagamentos|nu\s+financeira)\b/i },
  { key: "itau", name: "Itaú", pattern: /\b(?:ita[uú]|itaucard|credicard)\b/i },
  { key: "bradesco", name: "Bradesco", pattern: /\b(?:bradesco|bradescard)\b/i },
  { key: "santander", name: "Santander", pattern: /\bsantander\b/i },
  { key: "inter", name: "Inter", pattern: /\b(?:banco\s+inter|inter\s+s\.?a\.?|intermedium)\b/i },
  { key: "c6", name: "C6 Bank", pattern: /\b(?:c6\s*bank|banco\s+c6)\b/i },
  { key: "btg", name: "BTG Pactual", pattern: /\b(?:btg\s*pactual|banco\s+btg)\b/i },
  { key: "bb", name: "Banco do Brasil", pattern: /\b(?:banco\s+do\s+brasil|ourocard)\b/i },
  { key: "caixa", name: "Caixa", pattern: /\b(?:caixa\s+econ[oô]mica|cart[oõ]es\s+caixa)\b/i },
];

const MONTHS_AND_DATE_WORDS = new Set([
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
  "jan",
  "fev",
  "feb",
  "mar",
  "abr",
  "apr",
  "mai",
  "may",
  "jun",
  "jul",
  "ago",
  "aug",
  "set",
  "sep",
  "out",
  "oct",
  "nov",
  "dez",
  "dec",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
]);

const CURRENCY_AND_NOISE_WORDS = new Set([
  "brl",
  "usd",
  "eur",
  "gbp",
  "cad",
  "aud",
  "chf",
  "reais",
  "real",
  "dolar",
  "dolares",
  "rs",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "por",
  "com",
  "sem",
  "que",
  "seu",
  "sua",
  "seus",
  "suas",
  "este",
  "esta",
  "essa",
  "esse",
  "ao",
  "aos",
  "as",
  "os",
  "um",
  "uma",
  "ou",
  "sa",
  "ltda",
  "me",
  "epp",
]);

/**
 * Linhas que carregam dados pessoais (titular:, endereço:, CPF/CNPJ, email, telefone, código de barras)
 * e jamais devem entrar em fingerprints ou marcadores de blueprint.
 * Nota: palavras como "titular" ou "portador" sem ":" podem aparecer em títulos estruturais
 * legítimos (ex.: "Compras Cartão Titular") e não devem ser rejeitadas quando não trazem dados pessoais.
 */
const PII_LINE_PREFIX_REGEX =
  /(?:^\s*(?:titular|cliente|nome(?:\s+do\s+(?:cliente|titular|portador))?|portador|sacado|pagador|endere[çc]o|logradouro|bairro)\s*:|\b(?:cep\s*:|cpf\b|cnpj\b|e-?mail\s*:|telefone\s*:|celular\s*:|ag[eê]ncia\s*:|conta\s+corrente\s*:|nosso\s+n[uú]mero|linha\s+digit[aá]vel)\b)/i;

const EMAIL_OR_URL_REGEX = /\S+@\S+\.\S+|https?:\/\/\S+|www\.\S+/gi;
const CPF_CNPJ_REGEX =
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;

/**
 * Normaliza texto estrutural removendo estritamente PII, números, meses, anos, moedas e pontuação.
 */
export function sanitizeLineForStructuralTokens(line: string): string[] {
  if (!line || PII_LINE_PREFIX_REGEX.test(line)) {
    return [];
  }

  // Ignora linhas que parecem ser apenas nomes próprios (ex.: "JOAO CARLOS DA SILVA", 2-5 palavras maiúsculas sem termos bancários)
  const trimmed = line.trim();
  const hasStructuralKeyword =
    /\b(?:fatura|extrato|cart[aã]o|lan[çc]amentos|compras|despesas|cr[eé]ditos|valor|total|vencimento|fechamento|resumo|banco|cooperativa|pagamentos|encargos|parcelamento|saldo|data|descri[çc][aã]o|hist[oó]rico|estabelecimento|demonstrativo|detalhamento|movimenta[çc][oõ]es|transa[çc][oõ]es|limite|boleto|ficha|ouvidoria|atendimento)\b/i.test(
      trimmed,
    );
  const looksLikePersonName =
    !hasStructuralKeyword &&
    /^[A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][A-Za-zÀ-ÿ]+){1,4}$/.test(trimmed);
  if (looksLikePersonName) {
    return [];
  }

  const normalized = trimmed
    .replace(EMAIL_OR_URL_REGEX, " ")
    .replace(CPF_CNPJ_REGEX, " ")
    .replace(/(?:R\$|US\$|€|£)/gi, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/[^a-z\s]/g, " ");

  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t.length >= 3 &&
        !MONTHS_AND_DATE_WORDS.has(t) &&
        !CURRENCY_AND_NOISE_WORDS.has(t),
    );

  return tokens;
}

/**
 * Hash determinístico FNV-1a 32-bit em 8 caracteres hex (síncrono, puro e estável).
 */
function fnv1aHex8(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function slugifyIssuer(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 2 &&
        !MONTHS_AND_DATE_WORDS.has(w) &&
        !CURRENCY_AND_NOISE_WORDS.has(w) &&
        w !== "fatura" &&
        w !== "extrato" &&
        w !== "pdf" &&
        w !== "csv" &&
        w !== "xlsx" &&
        w !== "xls" &&
        w !== "ofx" &&
        w !== "txt",
    )
    .slice(0, 3)
    .join("_");
}

/**
 * Detecta o emissor da fatura (conhecido ou inédito) sem jamais incluir PII, mês ou números.
 */
export function detectIssuerIdentity(
  rawText: string,
  fileName?: string,
): { issuerKey: string; issuerName: string } {
  const headText = rawText.slice(0, 4000);
  const combinedHint = `${fileName ?? ""}\n${headText}`;

  for (const issuer of KNOWN_ISSUERS) {
    if (issuer.pattern.test(combinedHint)) {
      return { issuerKey: issuer.key, issuerName: issuer.name };
    }
  }

  // Para bancos inéditos: busca linha institucional de cabeçalho nas primeiras 25 linhas
  const topLines = headText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 25);

  const institutionRegex =
    /\b(banco\s+[a-zÀ-ÿ]+(?:\s+[a-zÀ-ÿ]+)?|cooperativa\s+[a-zÀ-ÿ]+(?:\s+[a-zÀ-ÿ]+)?|[a-zÀ-ÿ]+\s+(?:bank|card|pagamentos|financeira|credito|cr[eé]dito))\b/i;

  for (const line of topLines) {
    if (PII_LINE_PREFIX_REGEX.test(line)) continue;
    const match = institutionRegex.exec(line);
    if (match?.[1]) {
      const cleanName = match[1]
        .replace(/\d+/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const key = slugifyIssuer(cleanName);
      if (key.length >= 3) {
        return { issuerKey: key, issuerName: cleanName.slice(0, 60) };
      }
    }
  }

  // Fallback seguro a partir do nome do arquivo (removendo meses, anos e números)
  if (fileName) {
    const stem = fileName.replace(/\.[^.]+$/, "");
    const key = slugifyIssuer(stem);
    if (key.length >= 3) {
      const displayName = key
        .split("_")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
      return { issuerKey: key, issuerName: displayName };
    }
  }

  return { issuerKey: "unknown", issuerName: "Emissor Genérico" };
}

function fileKindToPrefix(fileKind: BlueprintFileKind): string {
  switch (fileKind) {
    case "pdf_text":
      return "pdf";
    case "csv":
      return "csv";
    case "xlsx":
      return "xlsx";
    case "ofx":
      return "ofx";
    case "text":
      return "text";
  }
}

/**
 * Gera um fingerprint determinístico, livre de PII e imune a mudanças de mês/ano/valores.
 * Fornece dois níveis para busca em `matcher.ts`:
 * - Nível 1: `<kind>:<issuerKey>:<headerTokensHash>`
 * - Nível 2 (fallback): `<kind>:<issuerKey>`
 */
export function computeStatementFingerprint(params: {
  rawText: string;
  fileKind: BlueprintFileKind;
  fileName?: string;
  headerLines?: readonly string[];
}): StatementFingerprintResult {
  const { rawText, fileKind, fileName, headerLines } = params;
  const { issuerKey, issuerName } = detectIssuerIdentity(rawText, fileName);

  const sourceLines =
    headerLines && headerLines.length > 0
      ? headerLines.slice(0, 40)
      : rawText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 40);

  // Seleciona linhas estruturais (cabeçalhos de seção/fatura, nunca linhas de compra com data+valor)
  const dateAndAmountRegex =
    /(?:\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b).*(?:\d+,\d{2}|\d+\.\d{2})/;

  const structuralTokenSet = new Set<string>();
  for (const line of sourceLines) {
    if (dateAndAmountRegex.test(line)) continue;
    const tokens = sanitizeLineForStructuralTokens(line);
    for (const tok of tokens) {
      structuralTokenSet.add(tok);
      if (structuralTokenSet.size >= 32) break;
    }
    if (structuralTokenSet.size >= 32) break;
  }

  const structuralTokens = Array.from(structuralTokenSet).sort();
  const headerTokensHash =
    structuralTokens.length > 0 ? fnv1aHex8(structuralTokens.join("|")) : "00000000";

  const prefix = fileKindToPrefix(fileKind);
  return {
    exactFingerprint: `${prefix}:${issuerKey}:${headerTokensHash}`,
    fallbackFingerprint: `${prefix}:${issuerKey}`,
    issuerKey,
    issuerName,
    headerTokensHash,
    structuralTokens,
  };
}
