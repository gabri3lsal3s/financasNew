/**
 * Decodificador e validador puro de linha digitável e código de barras de boletos bancários (47/44 dígitos)
 * e guias de arrecadação/concessionárias (48/44 dígitos) segundo o padrão Febraban.
 *
 * Função 100% pura: sem efeitos colaterais, sem dependências de UI, DOM ou rede.
 */

const FEBRABAN_OLD_EPOCH_UTC_MS = Date.UTC(1997, 9, 7); // 1997-10-07
const FEBRABAN_NEW_EPOCH_UTC_MS = Date.UTC(2025, 1, 22); // 2025-02-22 (fator reinicia em 1000)
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const BANK_CODE_NAMES: Readonly<Record<string, string>> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "041": "Banrisul",
  "070": "BRB",
  "077": "Banco Inter",
  "104": "Caixa Econômica",
  "197": "Stone",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "218": "BS2",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagSeguro",
  "318": "BMG",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "403": "Cora",
  "422": "Safra",
  "623": "Banco Pan",
  "637": "Sofisa",
  "655": "Neon",
  "745": "Citibank",
  "748": "Sicredi",
  "756": "Sicoob",
};

const ARRECADACAO_SEGMENT_LABELS: Readonly<Record<string, string>> = {
  "1": "Prefeitura / Tributo Municipal",
  "2": "Saneamento / Água e Esgoto",
  "3": "Energia Elétrica / Gás",
  "4": "Telecomunicações / Internet",
  "5": "Órgão Governamental / Tributo",
  "6": "Carnê / Demais Empresas",
  "7": "Multas de Trânsito",
  "9": "Uso Exclusivo do Banco",
};

export interface DecodedBankSlipBarcode {
  kind: "febraban" | "arrecadacao";
  digits: string;
  formattedLine: string;
  barcode44: string;
  isValidChecksum: boolean;
  amountCents: number | null;
  dueDate?: string;
  bankCode?: string;
  bankName?: string;
  segmentCode?: string;
  segmentLabel?: string;
}

/** Calcula o dígito verificador Módulo 10 (Febraban). */
export function modulo10(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    const num = digits.charCodeAt(i) - 48;
    if (num < 0 || num > 9) return -1;
    let prod = num * weight;
    if (prod > 9) prod = Math.floor(prod / 10) + (prod % 10);
    sum += prod;
    weight = weight === 2 ? 1 : 2;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/** Calcula o dígito verificador Módulo 11 padrão boleto bancário Febraban (44 dígitos). */
export function modulo11Febraban(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    const num = digits.charCodeAt(i) - 48;
    if (num < 0 || num > 9) return -1;
    sum += num * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const dv = 11 - remainder;
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

/** Calcula o dígito verificador Módulo 11 padrão guias de arrecadação/concessionárias. */
export function modulo11Arrecadacao(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    const num = digits.charCodeAt(i) - 48;
    if (num < 0 || num > 9) return -1;
    sum += num * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return 0;
  if (remainder === 10) return 1;
  return 11 - remainder;
}

function formatUtcMsToIsoDate(utcMs: number): string {
  const date = new Date(utcMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converte o fator de vencimento Febraban (4 dígitos) em data ISO `YYYY-MM-DD`,
 * contemplando o reinício de fator (`1000` em 22/02/2025) pela proximidade à data de referência.
 */
export function decodeFebrabanDueDate(
  dueFactor: number,
  referenceDate: Date = new Date(),
): string | undefined {
  if (!Number.isInteger(dueFactor) || dueFactor <= 0 || dueFactor > 9999) {
    return undefined;
  }

  const oldMs = FEBRABAN_OLD_EPOCH_UTC_MS + dueFactor * MS_PER_DAY;
  if (dueFactor < 1000) {
    return formatUtcMsToIsoDate(oldMs);
  }

  const newMs = FEBRABAN_NEW_EPOCH_UTC_MS + (dueFactor - 1000) * MS_PER_DAY;
  const refMs = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  // Escolhe o ciclo mais próximo da data de referência (suporta boletos históricos pré-2025 e boletos atuais pós-2025)
  const distOld = Math.abs(refMs - oldMs);
  const distNew = Math.abs(refMs - newMs);
  return formatUtcMsToIsoDate(distNew <= distOld ? newMs : oldMs);
}

/** Formata sequência numérica de 47 ou 48 dígitos no padrão legível brasileiro. */
export function formatDigitableLine(rawDigits: string): string {
  const digits = rawDigits.replace(/\D/g, "");
  if (digits.length === 47) {
    return `${digits.slice(0, 5)}.${digits.slice(5, 10)} ${digits.slice(10, 15)}.${digits.slice(15, 21)} ${digits.slice(21, 26)}.${digits.slice(26, 32)} ${digits.slice(32, 33)} ${digits.slice(33, 47)}`;
  }
  if (digits.length === 48) {
    return `${digits.slice(0, 11)}-${digits[11]} ${digits.slice(12, 23)}-${digits[23]} ${digits.slice(24, 35)}-${digits[35]} ${digits.slice(36, 47)}-${digits[47]}`;
  }
  return rawDigits.trim();
}

function decodeFebraban47(
  digits: string,
  referenceDate: Date,
): DecodedBankSlipBarcode | null {
  if (digits.length !== 47) return null;

  const field1 = digits.slice(0, 9);
  const dv1 = Number(digits[9]);
  const field2 = digits.slice(10, 20);
  const dv2 = Number(digits[20]);
  const field3 = digits.slice(21, 31);
  const dv3 = Number(digits[31]);
  const dvGeneral = Number(digits[32]);

  const barcode44 =
    digits.slice(0, 4) +
    digits[32] +
    digits.slice(33, 47) +
    digits.slice(4, 9) +
    digits.slice(10, 20) +
    digits.slice(21, 31);

  const barcodeWithoutDv = barcode44.slice(0, 4) + barcode44.slice(5);
  const isValidChecksum =
    modulo10(field1) === dv1 &&
    modulo10(field2) === dv2 &&
    modulo10(field3) === dv3 &&
    modulo11Febraban(barcodeWithoutDv) === dvGeneral;

  const bankCode = digits.slice(0, 3);
  const currencyCode = digits[3];
  const dueFactor = Number.parseInt(digits.slice(33, 37), 10);
  const rawAmount = Number.parseInt(digits.slice(37, 47), 10);
  const amountCents =
    currencyCode === "9" && Number.isFinite(rawAmount) && rawAmount > 0
      ? rawAmount
      : null;

  return {
    kind: "febraban",
    digits,
    formattedLine: formatDigitableLine(digits),
    barcode44,
    isValidChecksum,
    amountCents,
    dueDate: decodeFebrabanDueDate(dueFactor, referenceDate),
    bankCode,
    bankName: BANK_CODE_NAMES[bankCode],
  };
}

function decodeArrecadacao48(digits: string): DecodedBankSlipBarcode | null {
  if (digits.length !== 48 || digits[0] !== "8") return null;

  const blocks = [
    { data: digits.slice(0, 11), dv: Number(digits[11]) },
    { data: digits.slice(12, 23), dv: Number(digits[23]) },
    { data: digits.slice(24, 35), dv: Number(digits[35]) },
    { data: digits.slice(36, 47), dv: Number(digits[47]) },
  ];

  const barcode44 = blocks.map((b) => b.data).join("");
  const segmentCode = barcode44[1];
  const valueId = barcode44[2];
  const generalDv = Number(barcode44[3]);
  const barcodeWithoutDv = barcode44.slice(0, 3) + barcode44.slice(4);

  const useMod10 = valueId === "6" || valueId === "8";
  const useMod11 = valueId === "7" || valueId === "9";
  if (!useMod10 && !useMod11) return null;

  const calcDv = useMod10 ? modulo10 : modulo11Arrecadacao;
  const blocksValid = blocks.every((b) => calcDv(b.data) === b.dv);
  const generalValid = calcDv(barcodeWithoutDv) === generalDv;

  const isEffectiveBrlValue = valueId === "6" || valueId === "7";
  const rawAmount = Number.parseInt(barcode44.slice(4, 15), 10);
  const amountCents =
    isEffectiveBrlValue && Number.isFinite(rawAmount) && rawAmount > 0
      ? rawAmount
      : null;

  return {
    kind: "arrecadacao",
    digits,
    formattedLine: formatDigitableLine(digits),
    barcode44,
    isValidChecksum: blocksValid && generalValid,
    amountCents,
    segmentCode,
    segmentLabel: segmentCode ? ARRECADACAO_SEGMENT_LABELS[segmentCode] : undefined,
  };
}

function decodeBarcode44(
  digits: string,
  referenceDate: Date,
): DecodedBankSlipBarcode | null {
  if (digits.length !== 44) return null;

  if (digits[0] === "8") {
    const valueId = digits[2];
    const useMod10 = valueId === "6" || valueId === "8";
    const useMod11 = valueId === "7" || valueId === "9";
    if (!useMod10 && !useMod11) return null;

    const calcDv = useMod10 ? modulo10 : modulo11Arrecadacao;
    const generalValid = calcDv(digits.slice(0, 3) + digits.slice(4)) === Number(digits[3]);
    const isEffectiveBrlValue = valueId === "6" || valueId === "7";
    const rawAmount = Number.parseInt(digits.slice(4, 15), 10);

    return {
      kind: "arrecadacao",
      digits,
      formattedLine: digits,
      barcode44: digits,
      isValidChecksum: generalValid,
      amountCents:
        isEffectiveBrlValue && Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : null,
      segmentCode: digits[1],
      segmentLabel: digits[1] ? ARRECADACAO_SEGMENT_LABELS[digits[1]] : undefined,
    };
  }

  const bankCode = digits.slice(0, 3);
  const currencyCode = digits[3];
  const dvGeneral = Number(digits[4]);
  const dueFactor = Number.parseInt(digits.slice(5, 9), 10);
  const rawAmount = Number.parseInt(digits.slice(9, 19), 10);
  const isValidChecksum = modulo11Febraban(digits.slice(0, 4) + digits.slice(5)) === dvGeneral;

  return {
    kind: "febraban",
    digits,
    formattedLine: digits,
    barcode44: digits,
    isValidChecksum,
    amountCents:
      currencyCode === "9" && Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : null,
    dueDate: decodeFebrabanDueDate(dueFactor, referenceDate),
    bankCode,
    bankName: BANK_CODE_NAMES[bankCode],
  };
}

/**
 * Decodifica linha digitável (47 ou 48 dígitos) ou código de barras (44 dígitos),
 * extraindo valor em centavos, vencimento, banco emissor e validade dos dígitos verificadores.
 */
export function parseBankSlipDigitableLine(
  rawLine?: string | null,
  referenceDate: Date = new Date(),
): DecodedBankSlipBarcode | null {
  if (!rawLine || typeof rawLine !== "string") return null;
  const digits = rawLine.replace(/\D/g, "");
  if (digits.length === 47) {
    return decodeFebraban47(digits, referenceDate);
  }
  if (digits.length === 48) {
    return decodeArrecadacao48(digits);
  }
  if (digits.length === 44) {
    return decodeBarcode44(digits, referenceDate);
  }
  return null;
}
