/**
 * Detector Estendido de Periodicidade (Anual e Semanal) — ESPECIFICAÇÃO & F21.
 *
 * Expande a janela analítica para identificar:
 *   1. Compromissos anuais e sazonais frequentes (IPVA, IPTU, Seguro, Anuidade de Cartão, Matrícula)
 *      com alerta preventivo de 30 dias de antecedência:
 *      "No ano passado você pagou R$ X de [Nome] em [Mês]. Deseja provisionar este valor?"
 *   2. Compromissos de cadência semanal (terapia, diarista, feira, natação)
 *      com apresentação do custo mensal consolidado correspondente.
 */

import { formatBRL, medianOf, type ExpenseLike } from "./recurrences";
import { isOccurrenceIgnored, type FeedbackMap } from "./feedback";
import { normalizeText, stripTemporalSuffixes } from "./shared";

export const MONTH_NAMES_FULL_PTBR = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const DAY_OF_WEEK_LABELS_PTBR = [
  "Toda domingo",
  "Toda segunda-feira",
  "Toda terça-feira",
  "Toda quarta-feira",
  "Toda quinta-feira",
  "Toda sexta-feira",
  "Todo sábado",
] as const;

/** Padrões conhecidos de compromissos anuais e sazonais típicos brasileiros */
interface KnownAnnualPattern {
  id: string;
  label: string;
  regex: RegExp;
}

const KNOWN_ANNUAL_PATTERNS: readonly KnownAnnualPattern[] = [
  { id: "ipva", label: "IPVA", regex: /\b(?:ipva|detran\s*ipva|sefaz\s*ipva|imposto\s*veicular)\b/i },
  { id: "iptu", label: "IPTU", regex: /\b(?:iptu|prefeitura\s*iptu|imposto\s*predial)\b/i },
  {
    id: "seguro",
    label: "Seguro",
    regex: /\b(?:seguro(?:\s+auto|\s+residencial|\s+vida)?|porto\s*seguro|azul\s*seguros|tokio\s*marine|sulamerica|allianz|bradesco\s*seguros|youse)\b/i,
  },
  { id: "anuidade", label: "Anuidade", regex: /\b(?:anuidade(?:\s+cartao)?|taxa\s*anual|tarifa\s*anuidade)\b/i },
  { id: "matricula", label: "Matrícula", regex: /\b(?:matr[ií]cula|rematr[ií]cula|material\s*escolar)\b/i },
];

export interface AnnualCommitment {
  key: string;
  name: string;
  normalizedKey: string;
  categoryId?: string;
  categoryName?: string;
  lastPaymentDate: string;
  lastPaymentMonth: string;
  lastMonthName: string;
  lastValueCents: number;
  projectedDate: string;
  projectedMonth: string;
  daysUntilDue: number;
  isDueSoon: boolean;
  isAlreadyPaidThisYear: boolean;
  alertMessage: string;
  expenses: ExpenseLike[];
}

export interface DetectAnnualCommitmentsOptions {
  todayISO?: string;
  feedbackMap?: FeedbackMap;
}

/** Calcula a diferença de dias entre duas datas ISO YYYY-MM-DD (dateA - dateB) */
function diffInDays(isoA: string, isoB: string): number {
  const tA = new Date(`${isoA.slice(0, 10)}T00:00:00`).getTime();
  const tB = new Date(`${isoB.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((tA - tB) / 86_400_000);
}

/** Projeta uma data ISO do ano anterior para o ano de referência */
function projectToTargetYear(sourceDateISO: string, targetYear: number): string {
  const parts = sourceDateISO.slice(0, 10).split("-");
  const month = parts[1] ?? "01";
  let day = parseInt(parts[2] ?? "01", 10);

  // Tratamento de 29 de fevereiro em anos não-bissextos
  if (month === "02" && day === 29) {
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
    if (!isLeap) day = 28;
  }

  const paddedDay = String(day).padStart(2, "0");
  return `${targetYear}-${month}-${paddedDay}`;
}

type ExpenseWithDate = ExpenseLike & { date: string };

function hasValidDate(e: ExpenseLike): e is ExpenseWithDate {
  return typeof e.date === "string" && e.date.length >= 10 && e.valueCents > 0 && !e.installmentGroupId;
}

/**
 * Detecta compromissos anuais e sazonais (IPVA, IPTU, Seguros, Anuidade, etc.)
 * a partir do histórico de despesas, avaliando vencimentos nos próximos 30 dias.
 */
export function detectAnnualCommitments(
  expenses: readonly ExpenseLike[],
  options: DetectAnnualCommitmentsOptions = {},
): AnnualCommitment[] {
  const todayISO = options.todayISO ?? new Date().toISOString().slice(0, 10);
  const currentYear = parseInt(todayISO.slice(0, 4), 10);
  const feedbackMap = options.feedbackMap ?? {};

  // Filtra despesas com data válida e sem parcelamentos intermediários
  const validExpenses = expenses.filter(hasValidDate);

  if (validExpenses.length === 0) return [];

  // Agrupa despesas por chave identificadora de compromisso anual
  const groups = new Map<string, { label: string; expenses: ExpenseWithDate[] }>();

  for (const exp of validExpenses) {
    const rawDesc = (exp.description || "").trim();
    const cleanDesc = stripTemporalSuffixes(rawDesc) || rawDesc;
    const normalized = normalizeText(cleanDesc);

    // 1. Verifica se casa com padrões anuais conhecidos
    const pattern = KNOWN_ANNUAL_PATTERNS.find((p) => p.regex.test(normalized));
    let groupKey: string;
    let groupLabel: string;

    if (pattern) {
      groupKey = `annual:${pattern.id}`;
      groupLabel = pattern.label;
    } else {
      groupKey = `annual:${normalized}`;
      groupLabel = cleanDesc;
    }

    const current = groups.get(groupKey) ?? { label: groupLabel, expenses: [] };
    current.expenses.push(exp);
    groups.set(groupKey, current);
  }

  const commitments: AnnualCommitment[] = [];

  for (const [groupKey, group] of groups.entries()) {
    if (isOccurrenceIgnored(feedbackMap[groupKey])) continue;

    // Ordena do mais recente ao mais antigo
    const sorted = [...group.expenses].sort((a, b) => b.date.localeCompare(a.date));
    const isKnownPattern = KNOWN_ANNUAL_PATTERNS.some((p) => groupKey === `annual:${p.id}`);

    // Identifica transações dos anos anteriores ao ano atual
    const pastYearExpenses = sorted.filter((e) => {
      const expYear = parseInt(e.date.slice(0, 4), 10);
      return expYear < currentYear;
    });

    if (pastYearExpenses.length === 0) continue;

    // Identifica se há transação no ano corrente (já paga)
    const currentYearExpenses = sorted.filter((e) => {
      const expYear = parseInt(e.date.slice(0, 4), 10);
      return expYear === currentYear;
    });

    // Pega a despesa mais recente do ano anterior
    const lastPastExpense = pastYearExpenses[0]!;
    const lastPaymentDate = lastPastExpense.date.slice(0, 10);
    const lastPaymentMonth = lastPaymentDate.slice(0, 7);
    const lastMonthNum = parseInt(lastPaymentDate.slice(5, 7), 10);
    const lastMonthName = MONTH_NAMES_FULL_PTBR[lastMonthNum - 1] ?? "Janeiro";
    const lastValueCents = lastPastExpense.valueCents;

    // Se não for um padrão nominalmente conhecido (ex: IPVA), exige que haja espaçamento
    // anual comprovado (entre 330 e 400 dias) entre transações históricas
    if (!isKnownPattern && sorted.length >= 2) {
      let hasYearlySpacing = false;
      for (let i = 0; i < sorted.length - 1; i++) {
        const diff = Math.abs(diffInDays(sorted[i]!.date, sorted[i + 1]!.date));
        if (diff >= 320 && diff <= 410) {
          hasYearlySpacing = true;
          break;
        }
      }
      if (!hasYearlySpacing) continue;
    } else if (!isKnownPattern && sorted.length < 2) {
      // Sem padrão conhecido e com apenas 1 registro histórico isolado, não inferimos como anual
      continue;
    }

    // Projeção da data esperada no ano corrente
    const projectedDate = projectToTargetYear(lastPaymentDate, currentYear);
    const projectedMonth = projectedDate.slice(0, 7);
    const daysUntilDue = diffInDays(projectedDate, todayISO);

    // Avalia se já foi pago no ano corrente com valor condizente (tolerância ±40%)
    const isAlreadyPaidThisYear = currentYearExpenses.some((e) => {
      const diffDays = Math.abs(diffInDays(e.date, projectedDate));
      const valDiff = Math.abs(e.valueCents - lastValueCents) / Math.max(lastValueCents, 1);
      return diffDays <= 60 && valDiff <= 0.4;
    });

    // Alerta preventivo com 30 dias de antecedência (ou no mês de vencimento se não pago)
    const isDueSoon =
      !isAlreadyPaidThisYear &&
      ((daysUntilDue >= 0 && daysUntilDue <= 30) || (daysUntilDue < 0 && daysUntilDue >= -31 && todayISO.slice(0, 7) === projectedMonth));

    const alertMessage = `No ano passado você pagou ${formatBRL(lastValueCents)} de ${group.label} em ${lastMonthName}. Deseja provisionar este valor?`;

    commitments.push({
      key: groupKey,
      name: group.label,
      normalizedKey: normalizeText(group.label),
      categoryId: lastPastExpense.categoryId,
      categoryName: lastPastExpense.categoryName ?? undefined,
      lastPaymentDate,
      lastPaymentMonth,
      lastMonthName,
      lastValueCents,
      projectedDate,
      projectedMonth,
      daysUntilDue,
      isDueSoon,
      isAlreadyPaidThisYear,
      alertMessage,
      expenses: sorted,
    });
  }

  // Ordena compromissos pelo prazo de vencimento mais próximo
  return commitments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export interface WeeklyCommitment {
  key: string;
  name: string;
  categoryName?: string;
  categoryId?: string;
  averageWeeklyCents: number;
  monthlyConsolidatedCents: number;
  occurrencesPerMonth: number;
  dayOfWeek: number;
  dayOfWeekLabel: string;
  confidence: number;
  expenses: ExpenseLike[];
  active: boolean;
}

export interface DetectWeeklyCommitmentsOptions {
  todayISO?: string;
  feedbackMap?: FeedbackMap;
}

const KNOWN_WEEKLY_KEYWORDS = [
  "terapia",
  "psicolog",
  "diarista",
  "faxina",
  "feira",
  "personal",
  "pilates",
  "natacao",
  "fisioterapia",
  "lavanderia",
  "aula de",
];

/**
 * Detecta compromissos com cadência semanal (terapia, diarista, feira, natação, etc.)
 * e calcula o custo mensal consolidado correspondente.
 */
export function detectWeeklyCommitments(
  expenses: readonly ExpenseLike[],
  options: DetectWeeklyCommitmentsOptions = {},
): WeeklyCommitment[] {
  const todayISO = options.todayISO ?? new Date().toISOString().slice(0, 10);
  const feedbackMap = options.feedbackMap ?? {};

  // Filtra despesas com data válida e sem parcelamentos
  const validExpenses = expenses.filter(hasValidDate);

  if (validExpenses.length === 0) return [];

  // Agrupa por descrição limpa
  const groups = new Map<string, { rawName: string; expenses: ExpenseWithDate[] }>();

  for (const exp of validExpenses) {
    const rawDesc = (exp.description || "").trim();
    const cleanDesc = stripTemporalSuffixes(rawDesc) || rawDesc;
    const normalized = normalizeText(cleanDesc);

    const current = groups.get(normalized) ?? { rawName: cleanDesc, expenses: [] };
    current.expenses.push(exp);
    groups.set(normalized, current);
  }

  const commitments: WeeklyCommitment[] = [];

  for (const [normKey, group] of groups.entries()) {
    const key = `weekly:${normKey}`;
    if (isOccurrenceIgnored(feedbackMap[key])) continue;

    // Necessário pelo menos 3 lançamentos para caracterizar periodicidade semanal
    if (group.expenses.length < 3) continue;

    // Ordena cronologicamente do mais antigo ao mais recente
    const sorted = [...group.expenses].sort((a, b) => a.date.localeCompare(b.date));

    // Calcula os intervalos em dias entre transações sucessivas
    const intervals: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff = diffInDays(sorted[i + 1]!.date, sorted[i]!.date);
      if (diff > 0) {
        intervals.push(diff);
      }
    }

    if (intervals.length < 2) continue;

    const avgInterval = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;

    // Verifica se os intervalos são compatíveis com cadência semanal (típico 5 a 9 dias)
    const isKnownWeeklyKeyword = KNOWN_WEEKLY_KEYWORDS.some((kw) => normKey.includes(kw));
    const weeklyIntervalsCount = intervals.filter((d) => d >= 4 && d <= 10).length;
    const weeklyIntervalsRatio = weeklyIntervalsCount / intervals.length;

    const isWeeklyCadence =
      (avgInterval >= 5 && avgInterval <= 9 && weeklyIntervalsRatio >= 0.6) ||
      (isKnownWeeklyKeyword && avgInterval >= 4 && avgInterval <= 12 && weeklyIntervalsRatio >= 0.5);

    if (!isWeeklyCadence) continue;

    // Checagem de consistência de valores (tolerância ±35% da mediana)
    const values = sorted.map((e) => e.valueCents);
    const medianVal = medianOf(values);
    if (medianVal <= 0) continue;

    const valuesWithinTolerance = values.filter(
      (v) => Math.abs(v - medianVal) / medianVal <= 0.35,
    );
    if (valuesWithinTolerance.length / values.length < 0.6) continue;

    // Dia da semana predominante (0 = Domingo a 6 = Sábado)
    const daysOfWeek = sorted.map((e) => {
      const d = new Date(`${e.date.slice(0, 10)}T00:00:00`);
      return d.getDay();
    });
    const dayCounts = new Map<number, number>();
    for (const d of daysOfWeek) {
      dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
    }
    let predominantDay = 1;
    let maxCount = -1;
    for (const [day, count] of dayCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        predominantDay = day;
      }
    }

    const dayOfWeekLabel = DAY_OF_WEEK_LABELS_PTBR[predominantDay] ?? "Toda semana";

    // Cálculo do valor semanal médio e custo mensal consolidado (4 semanas)
    const averageWeeklyCents = medianVal;
    const monthlyConsolidatedCents = Math.round(averageWeeklyCents * 4);

    // Avaliação de atividade (última transação nos últimos 28 dias)
    const latestDate = sorted[sorted.length - 1]!.date;
    const daysSinceLatest = Math.abs(diffInDays(todayISO, latestDate));
    const active = daysSinceLatest <= 28;

    // Confiança matemática
    let confidence = isKnownWeeklyKeyword ? 0.85 : 0.72;
    if (sorted.length >= 6) confidence += 0.08;
    if (weeklyIntervalsRatio >= 0.8) confidence += 0.05;
    confidence = Math.min(0.98, Number(confidence.toFixed(2)));

    const first = sorted[sorted.length - 1]!;

    commitments.push({
      key,
      name: group.rawName,
      categoryId: first.categoryId,
      categoryName: first.categoryName ?? undefined,
      averageWeeklyCents,
      monthlyConsolidatedCents,
      occurrencesPerMonth: 4,
      dayOfWeek: predominantDay,
      dayOfWeekLabel,
      confidence,
      expenses: [...sorted].reverse(),
      active,
    });
  }

  // Ordena por custo mensal consolidado decrescente
  return commitments.sort((a, b) => b.monthlyConsolidatedCents - a.monthlyConsolidatedCents);
}
