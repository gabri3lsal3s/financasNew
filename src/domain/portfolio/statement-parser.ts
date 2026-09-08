/**
 * Parser Inteligente de Extratos e Séries Temporais de Carteiras.
 *
 * Princípios:
 * 1. Função 100% pura, sem efeitos colaterais ou dependências de UI/banco;
 * 2. Suporte a formatos de bancos/corretoras brasileiras (XP, BTG, Itaú, Kinvo, Gorila, etc.);
 * 3. Detecção de anos bissextos e datas de fechamento de mês (ex.: 2024-02-29);
 * 4. Conversão automática de Valor Aplicado Acumulado em Deltas (Aporte vs Resgate).
 */

export interface ParsedMonthlyRow {
  /** Linha original do texto para rastreabilidade. */
  rawLine: string;
  /** Data final do mês em formato ISO (YYYY-MM-DD). */
  date: string;
  /** Rótulo amigável (ex.: "Out/2023"). */
  label: string;
  /** Valor aplicado acumulado informado no extrato. */
  appliedValue: number;
  /** Saldo bruto no mês, se disponível. */
  grossBalance?: number;
  /** Rentabilidade percentual informada no mês, se disponível. */
  ratePct?: number;
  /** Variação líquida calculada em relação ao mês anterior. */
  delta: number;
  /** Classificação do fluxo. */
  type: "aporte" | "resgate" | "neutro";
  /** Descrição sugerida para o marco. */
  suggestedNotes: string;
}

export interface StatementParseResult {
  /** Linhas válidas processadas em ordem cronológica. */
  rows: ParsedMonthlyRow[];
  /** Marcos prontos para gravação (apenas onde houve movimentação real). */
  actionableRows: ParsedMonthlyRow[];
  /** Soma total dos aportes brutos (+). */
  totalAportes: number;
  /** Soma total dos resgates brutos (-). */
  totalResgates: number;
  /** Capital líquido resultante no bolso (Aportes - Resgates). */
  netCapital: number;
  /** Saldo bruto final detectado, se informado. */
  finalGrossBalance?: number;
  /** Quantidade de linhas descartadas ou com erro de formato. */
  skippedCount: number;
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  março: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getLastDayOfMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Converte string de moeda pt-BR ("R$ 1.234,56", "13.527,62", "13527.62") para número em ponto flutuante.
 */
export function parseBRLNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[R$\s]/g, "").trim();
  if (!cleaned) return null;

  // Se contém barra '/', é uma data (ex: 10/2023) ou razão, não um valor monetário
  if (cleaned.includes("/")) return null;

  // Se contém hifens no meio, não é número simples (ex: 2023-10)
  if (cleaned.includes("-") && !cleaned.startsWith("-")) return null;

  // Se já possui vírgula como decimal (padrão BR: 1.234,56 ou 1234,56)
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const val = Number(normalized);
    return isNaN(val) ? null : val;
  }

  // Se possui ponto como decimal sem vírgula (ex: 6187.37)
  // Certifica-se de que é um número completo válido
  const val = Number(cleaned);
  return isNaN(val) ? null : val;
}

/**
 * Tenta extrair Mês e Ano de tokens da linha.
 * Suporta:
 * - "Out. 2023" ou "Out 2023"
 * - "10/2023" ou "2023-10"
 * - "Outubro/2023"
 */
function extractMonthYear(tokens: string[]): { month: number; year: number; monthToken: string; yearToken: string } | null {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!.toLowerCase().replace(/\./g, "").trim();

    // 1. Caso numérico combinado: MM/YYYY ou YYYY-MM
    if (token.includes("/") || token.includes("-")) {
      const sep = token.includes("/") ? "/" : "-";
      const parts = token.split(sep);
      if (parts.length === 2) {
        const p1 = parseInt(parts[0]!, 10);
        const p2 = parseInt(parts[1]!, 10);
        if (p1 >= 1 && p1 <= 12 && p2 >= 2000 && p2 <= 2099) {
          return { month: p1, year: p2, monthToken: parts[0]!, yearToken: parts[1]! };
        }
        if (p2 >= 1 && p2 <= 12 && p1 >= 2000 && p1 <= 2099) {
          return { month: p2, year: p1, monthToken: parts[1]!, yearToken: parts[0]! };
        }
      }
    }

    // 2. Caso nome do mês + ano no próximo token (ex.: "Out." "2023")
    const monthNum = MONTH_NAME_MAP[token];
    if (monthNum !== undefined && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1]!.trim();
      const year = parseInt(nextToken, 10);
      if (year >= 2000 && year <= 2099) {
        return { month: monthNum, year, monthToken: tokens[i]!, yearToken: nextToken };
      }
    }
  }

  return null;
}

/**
 * Processa um texto bruto de extrato bancário ou planilha e gera a lista estruturada de marcos históricos.
 */
export function parseBrokerStatement(rawText: string): StatementParseResult {
  const lines = rawText.split(/\r?\n/);
  const intermediate: {
    rawLine: string;
    date: string;
    label: string;
    year: number;
    month: number;
    appliedValue: number;
    grossBalance?: number;
    ratePct?: number;
  }[] = [];

  let skippedCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Ignora cabeçalhos e totalizadores/rodapés óbvios
    const lower = trimmed.toLowerCase();
    if (
      ((lower.includes("mês") || lower.includes("mes")) &&
        (lower.includes("ano") || lower.includes("aplicado") || lower.includes("saldo"))) ||
      lower.startsWith("total") ||
      lower.startsWith("subtotal") ||
      lower.startsWith("média") ||
      lower.startsWith("media") ||
      lower.startsWith("consolidado") ||
      lower.startsWith("fonte") ||
      lower.startsWith("emitido") ||
      lower.startsWith("página") ||
      lower.startsWith("pagina") ||
      lower.startsWith("extrato")
    ) {
      continue;
    }

    // Divide por tabs, ponto-e-vírgula ou espaços múltiplos
    const tokens = trimmed.split(/[\t;]+/).flatMap((t) => t.trim().split(/\s{2,}/)).filter(Boolean);
    const combinedTokens = tokens.length <= 2 ? trimmed.split(/\s+/).filter(Boolean) : tokens;

    const my = extractMonthYear(combinedTokens);
    if (!my) {
      skippedCount++;
      continue;
    }

    // Coleta números presentes na linha descartando o token do ano
    const numbers: number[] = [];
    for (const t of combinedTokens) {
      if (t === my.yearToken || t.toLowerCase() === my.monthToken.toLowerCase()) continue;
      const parsed = parseBRLNumber(t);
      if (parsed !== null && !isNaN(parsed)) {
        numbers.push(parsed);
      }
    }

    if (numbers.length === 0) {
      skippedCount++;
      continue;
    }

    // O primeiro número após o mês/ano é o "Valor aplicado" (ou custo)
    const appliedValue = numbers[0]!;
    // O segundo número, se houver, é o "Saldo bruto"
    const grossBalance = numbers.length >= 2 ? numbers[1] : undefined;
    // O terceiro número, se houver, é a rentabilidade do mês (%)
    const ratePct = numbers.length >= 3 ? numbers[2] : undefined;

    const day = getLastDayOfMonth(my.year, my.month);
    const dateStr = `${my.year}-${String(my.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const monthShortNames = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];
    const label = `${monthShortNames[my.month - 1]}/${my.year}`;

    intermediate.push({
      rawLine: trimmed,
      date: dateStr,
      label,
      year: my.year,
      month: my.month,
      appliedValue: Math.round(appliedValue * 100) / 100,
      grossBalance: grossBalance !== undefined ? Math.round(grossBalance * 100) / 100 : undefined,
      ratePct: ratePct !== undefined ? Math.round(ratePct * 100) / 100 : undefined,
    });
  }

  // Ordena cronologicamente por data
  intermediate.sort((a, b) => a.date.localeCompare(b.date));

  // Elimina possíveis duplicatas de data (mantém o último)
  const dateMap = new Map<string, (typeof intermediate)[0]>();
  for (const item of intermediate) {
    dateMap.set(item.date, item);
  }
  const sorted = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const rows: ParsedMonthlyRow[] = [];
  let prevApplied = 0;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;
    const delta = Math.round((item.appliedValue - prevApplied) * 100) / 100;
    prevApplied = item.appliedValue;

    let type: "aporte" | "resgate" | "neutro";
    let suggestedNotes: string;

    if (delta > 0.01) {
      type = "aporte";
      suggestedNotes =
        i === 0
          ? `Marco Histórico · Início (${item.label})`
          : `Aporte Histórico (${item.label})`;
    } else if (delta < -0.01) {
      type = "resgate";
      suggestedNotes = `[Resgate] Retirada do Bolso (${item.label})`;
    } else {
      type = "neutro";
      suggestedNotes = `Sem movimentação (${item.label})`;
    }

    if (item.ratePct !== undefined) {
      const formattedRate = item.ratePct > 0 ? `+${item.ratePct}` : `${item.ratePct}`;
      suggestedNotes += ` [Rent: ${formattedRate}%]`;
    }

    rows.push({
      rawLine: item.rawLine,
      date: item.date,
      label: item.label,
      appliedValue: item.appliedValue,
      grossBalance: item.grossBalance,
      ratePct: item.ratePct,
      delta,
      type,
      suggestedNotes,
    });
  }

  const actionableRows = rows.filter((r) => r.type !== "neutro");

  const totalAportes =
    Math.round(
      actionableRows.filter((r) => r.type === "aporte").reduce((acc, r) => acc + r.delta, 0) * 100
    ) / 100;

  const totalResgates =
    Math.round(
      actionableRows.filter((r) => r.type === "resgate").reduce((acc, r) => acc + Math.abs(r.delta), 0) * 100
    ) / 100;

  const netCapital = Math.round((totalAportes - totalResgates) * 100) / 100;

  const lastRow = rows[rows.length - 1];
  const finalGrossBalance = lastRow?.grossBalance;

  return {
    rows,
    actionableRows,
    totalAportes,
    totalResgates,
    netCapital,
    finalGrossBalance,
    skippedCount,
  };
}

/**
 * Extrai a rentabilidade percentual explícita gravada nas notas de um marco/contribuição.
 * Suporta formatos: "[Rent: +2.16%]", "[Rent: -0.80%]", "[Taxa: 1.5%]"
 */
export function extractExplicitRateFromNotes(notes?: string | null): number | null {
  if (!notes) return null;
  const match = notes.match(/\[(?:rent|taxa|retorno):\s*([+-]?\d+(?:[.,]\d+)?)%?\]/i);
  if (!match || !match[1]) return null;
  const val = parseFloat(match[1].replace(",", "."));
  return isNaN(val) ? null : val;
}

/**
 * Remove marcadores de sistema ([Resgate], [Retirada], [Rent: ...]) para exibição limpa ao usuário.
 */
export function cleanContributionNotes(notes?: string | null): string {
  if (!notes) return "";
  return notes
    .replace(/^\[(?:resgate|retirada)\]\s*/i, "")
    .replace(/\[(?:rent|taxa|retorno):\s*[+-]?\d+(?:[.,]\d+)?%?\]/gi, "")
    .trim();
}

export interface DeduplicateStatementRowsResult {
  /** Linhas acionáveis que são realmente novas e devem ser criadas. */
  newRows: ParsedMonthlyRow[];
  /** Linhas acionáveis que já existiam e foram desconsideradas para evitar duplicata. */
  skippedExistingRows: ParsedMonthlyRow[];
}

/**
 * Deduplica as linhas acionáveis contra os marcos históricos já registrados pelo usuário no banco.
 * Compara por mês (YYYY-MM) ou data exata (YYYY-MM-DD).
 */
export function deduplicateStatementRows(
  existingContributions: readonly { date: string; amount: number; notes?: string | null }[],
  incomingRows: readonly ParsedMonthlyRow[],
): DeduplicateStatementRowsResult {
  const existingMonths = new Set(existingContributions.map((c) => c.date.slice(0, 7)));
  const existingExactDates = new Set(existingContributions.map((c) => c.date));

  const newRows: ParsedMonthlyRow[] = [];
  const skippedExistingRows: ParsedMonthlyRow[] = [];

  for (const row of incomingRows) {
    const monthStr = row.date.slice(0, 7);
    if (existingExactDates.has(row.date) || existingMonths.has(monthStr)) {
      skippedExistingRows.push(row);
    } else {
      newRows.push(row);
    }
  }

  return { newRows, skippedExistingRows };
}


