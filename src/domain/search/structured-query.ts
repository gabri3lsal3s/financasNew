/**
 * Parser estruturado e expansor semântico local (< 2 ms) para busca natural em pt-BR.
 * Suporta filtros por valor ("acima de 200", "até 50", "entre 100 e 300"), atributos
 * ("parcelado", "recorrente", "pix", "crédito", "familiar", "estorno", "encargos"),
 * janelas temporais ("hoje", "ontem", "mês passado", "últimos 3 meses", nome de mês)
 * e expansão conceitual integrada ao `merchantLearning` (`semanticTags` + `rawAliases`).
 *
 * Motor 100% puro — zero dependências de UI ou Supabase.
 */

import { shiftMonth } from "@/domain/cards";
import type { MerchantLearningMemory } from "@/domain/notifications/merchant-memory";

export type StructuredMonthScope =
  | { kind: "today"; dateISO: string }
  | { kind: "yesterday"; dateISO: string }
  | { kind: "current_month"; month: string }
  | { kind: "previous_month"; month: string }
  | { kind: "last_3_months"; fromMonth: string; toMonth: string }
  | { kind: "specific_month"; month: string; label: string };

export interface StructuredSearchQuery {
  rawQuery: string;
  normalizedQuery: string;
  nature?: "expense" | "income";
  paymentMethod?: "pix" | "credit_card" | "debit" | "cash" | "transfer";
  minAmountCents?: number;
  maxAmountCents?: number;
  onlyInstallments: boolean;
  onlyRecurring: boolean;
  onlyFamily: boolean;
  onlyTrips: boolean;
  onlyRefunds: boolean;
  onlyCardCharges: boolean;
  isBiggestQuery: boolean;
  monthScope: StructuredMonthScope | null;
  textTokens: string[];
  tokenExpansions: Record<string, string[]>;
  hasAnalyticalIntent: boolean;
}

export interface ParseStructuredQueryOptions {
  todayISO?: string;
  referenceMonth?: string;
  merchantLearning?: MerchantLearningMemory;
}

const MONTH_NAMES: readonly { regex: RegExp; monthIndex: number; label: string }[] = [
  { regex: /\bjaneiro\b/g, monthIndex: 1, label: "Janeiro" },
  { regex: /\bfevereiro\b/g, monthIndex: 2, label: "Fevereiro" },
  { regex: /\bmarco\b/g, monthIndex: 3, label: "Março" },
  { regex: /\babril\b/g, monthIndex: 4, label: "Abril" },
  { regex: /\bmaio\b/g, monthIndex: 5, label: "Maio" },
  { regex: /\bjunho\b/g, monthIndex: 6, label: "Junho" },
  { regex: /\bjulho\b/g, monthIndex: 7, label: "Julho" },
  { regex: /\bagosto\b/g, monthIndex: 8, label: "Agosto" },
  { regex: /\bsetembro\b/g, monthIndex: 9, label: "Setembro" },
  { regex: /\boutubro\b/g, monthIndex: 10, label: "Outubro" },
  { regex: /\bnovembro\b/g, monthIndex: 11, label: "Novembro" },
  { regex: /\bdezembro\b/g, monthIndex: 12, label: "Dezembro" },
];

export const CONCEPT_SYNONYMS_GRAPH: Record<string, readonly string[]> = {
  pet: ["pet", "pets", "petz", "cobasi", "petlove", "petshop", "veterinario", "vet", "racao", "cachorro", "gato", "animal"],
  pets: ["pet", "pets", "petz", "cobasi", "petlove", "petshop", "veterinario", "racao"],
  racao: ["racao", "pet", "petz", "cobasi", "petlove"],
  veterinario: ["veterinario", "vet", "pet", "clinica veterinaria"],
  streaming: ["streaming", "netflix", "spotify", "disney", "max", "hbo", "globoplay", "prime", "youtube", "appletv", "crunchyroll"],
  delivery: ["delivery", "ifood", "rappi", "99food", "ze delivery", "lanche", "restaurante"],
  ifood: ["ifood", "delivery", "restaurante"],
  transporte: ["transporte", "uber", "99", "99app", "cabify", "combustivel", "gasolina", "etanol", "posto", "estacionamento", "pedagio", "metro", "onibus", "sem parar", "veloe"],
  mobilidade: ["mobilidade", "transporte", "uber", "99", "posto", "combustivel", "estacionamento", "pedagio"],
  uber: ["uber", "99", "cabify", "transporte"],
  carro: ["carro", "auto", "automovel", "veiculo", "ipva", "combustivel", "gasolina", "posto", "oficina", "mecanico", "estacionamento", "pedagio", "pneu"],
  gasolina: ["gasolina", "combustivel", "etanol", "posto", "shell", "ipiranga", "br"],
  farmacia: ["farmacia", "drogaria", "droga raia", "drogasil", "pague menos", "panvel", "remedio", "medicamento", "saude"],
  remedio: ["remedio", "medicamento", "farmacia", "drogaria"],
  mercado: ["mercado", "supermercado", "hortifruti", "atacadao", "assai", "carrefour", "pao de acucar", "extra", "zaffari", "compras do mes"],
  supermercado: ["supermercado", "mercado", "hortifruti", "atacadao", "assai", "carrefour"],
  reforma: ["reforma", "obra", "construcao", "leroy", "telhanorte", "ferragem", "eletrica", "hidraulica", "tintas", "casa"],
  obra: ["obra", "reforma", "construcao", "leroy", "ferragem", "casa"],
  impostos: ["imposto", "impostos", "iptu", "ipva", "irpf", "darf", "das", "mei", "tributo", "taxa"],
  academia: ["academia", "fitness", "smartfit", "smart fit", "bluefit", "wellhub", "totalpass", "gympass"],
  educacao: ["educacao", "faculdade", "escola", "curso", "udemy", "alura", "livro", "mensalidade"],
};

const QUERY_STOPWORDS = new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "com",
  "por",
  "para",
  "pra",
  "foi",
  "foram",
  "e",
  "que",
  "se",
  "eu",
  "meu",
  "minha",
  "meus",
  "minhas",
  "quais",
  "qual",
  "quanto",
  "total",
  "gasto",
  "gastos",
  "gastei",
  "valor",
  "valores",
  "reais",
  "brl",
  "mes",
  "meses",
  "maior",
  "maiores",
  "ultimo",
  "ultimos",
  "esse",
  "este",
  "nesse",
  "neste",
  "atual",
  "tudo",
]);

function normalizeQueryString(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parsePtBrNumberToCents(raw: string): number | undefined {
  let clean = raw.trim().replace(/^r\$\s*/i, "").replace(/\s+/g, "");
  if (!clean || !/\d/.test(clean)) return undefined;

  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    clean = clean.replace(/\./g, "");
  }

  const parsed = Number(clean);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999_999_999) {
    return undefined;
  }
  return Math.round(parsed * 100);
}

function shiftIsoDay(isoDate: string, deltaDays: number): string {
  const parts = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, (parts[2] || 1) + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

function formatCentsShortBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function buildLearningExpansionMap(
  memory?: MerchantLearningMemory,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  if (!memory) return index;

  for (const record of Object.values(memory)) {
    if (!record || !record.friendlyName) continue;
    const friendlyNorm = normalizeQueryString(record.friendlyName);
    if (!friendlyNorm) continue;

    const candidateTerms = new Set<string>([friendlyNorm]);
    for (const alias of record.rawAliases ?? []) {
      const a = normalizeQueryString(alias);
      if (a) candidateTerms.add(a);
    }

    const keysToLink = [
      ...(record.semanticTags ?? []).map((t) => normalizeQueryString(t)),
      ...(record.serviceSegment ? [normalizeQueryString(record.serviceSegment)] : []),
      friendlyNorm,
    ].filter((k) => k.length >= 2);

    for (const key of keysToLink) {
      const bucket = index.get(key) ?? new Set<string>();
      for (const term of candidateTerms) {
        bucket.add(term);
      }
      index.set(key, bucket);
    }
  }

  return index;
}

/**
 * Converte uma string de consulta natural em filtros determinísticos e expansões semânticas.
 */
export function parseStructuredSearchQuery(
  rawQuery: string,
  options: ParseStructuredQueryOptions = {},
): StructuredSearchQuery {
  const normalizedQuery = normalizeQueryString(rawQuery);
  const todayISO = options.todayISO || new Date().toISOString().slice(0, 10);
  const referenceMonth = options.referenceMonth || todayISO.slice(0, 7);

  let working = normalizedQuery;
  let minAmountCents: number | undefined;
  let maxAmountCents: number | undefined;
  let nature: "expense" | "income" | undefined;
  let paymentMethod: StructuredSearchQuery["paymentMethod"];
  let onlyInstallments = false;
  let onlyRecurring = false;
  let onlyFamily = false;
  let onlyTrips = false;
  let onlyRefunds = false;
  let onlyCardCharges = false;
  let isBiggestQuery = false;
  let monthScope: StructuredMonthScope | null = null;

  const hasAnalyticalIntent =
    /^(?:quanto|total|gasto|gastos|gastei|valor|quais|maiores|maior\s+gasto|compras\s+(?:parcelad|acima|abaixo|no|na|do|da))/.test(
      normalizedQuery,
    );

  // 1. Limites monetários
  const betweenRegex = /\bentre\s+(?:r\$\s*)?([\d.,]+)\s+e\s+(?:r\$\s*)?([\d.,]+)/;
  const betweenMatch = working.match(betweenRegex);
  if (betweenMatch && betweenMatch[1] && betweenMatch[2]) {
    const a = parsePtBrNumberToCents(betweenMatch[1]);
    const b = parsePtBrNumberToCents(betweenMatch[2]);
    if (a !== undefined && b !== undefined) {
      minAmountCents = Math.min(a, b);
      maxAmountCents = Math.max(a, b);
      working = working.replace(betweenRegex, " ");
    }
  }

  const minRegex = /(?:acima\s+de|maior(?:es)?\s+que|mais\s+de|>=|>)\s*(?:r\$\s*)?([\d.,]+)/;
  const minMatch = working.match(minRegex);
  if (minMatch && minMatch[1]) {
    const val = parsePtBrNumberToCents(minMatch[1]);
    if (val !== undefined) {
      minAmountCents = val;
      working = working.replace(minRegex, " ");
    }
  }

  const maxRegex = /(?:ate|abaixo\s+de|menor(?:es)?\s+que|menos\s+de|<=|<)\s*(?:r\$\s*)?([\d.,]+)/;
  const maxMatch = working.match(maxRegex);
  if (maxMatch && maxMatch[1]) {
    const val = parsePtBrNumberToCents(maxMatch[1]);
    if (val !== undefined) {
      maxAmountCents = val;
      working = working.replace(maxRegex, " ");
    }
  }

  // 2. Escopo temporal
  if (/\b(?:nos\s+)?(?:ultimos\s+3\s+meses|ultimos\s+tres\s+meses|ultimo\s+trimestre)\b/.test(working)) {
    monthScope = {
      kind: "last_3_months",
      fromMonth: shiftMonth(referenceMonth, -2),
      toMonth: referenceMonth,
    };
    working = working.replace(/\b(?:nos\s+)?(?:ultimos\s+3\s+meses|ultimos\s+tres\s+meses|ultimo\s+trimestre)\b/g, " ");
  } else if (/\b(?:no\s+)?(?:mes\s+passado|ultimo\s+mes)\b/.test(working)) {
    monthScope = {
      kind: "previous_month",
      month: shiftMonth(referenceMonth, -1),
    };
    working = working.replace(/\b(?:no\s+)?(?:mes\s+passado|ultimo\s+mes)\b/g, " ");
  } else if (/\b(?:(?:n?este|esse)\s+mes|do\s+mes|mes\s+atual)\b/.test(working)) {
    monthScope = {
      kind: "current_month",
      month: referenceMonth,
    };
    working = working.replace(/\b(?:(?:n?este|esse)\s+mes|do\s+mes|mes\s+atual)\b/g, " ");
  } else if (/\bhoje\b/.test(working)) {
    monthScope = { kind: "today", dateISO: todayISO };
    working = working.replace(/\bhoje\b/g, " ");
  } else if (/\bontem\b/.test(working)) {
    monthScope = { kind: "yesterday", dateISO: shiftIsoDay(todayISO, -1) };
    working = working.replace(/\bontem\b/g, " ");
  } else {
    const refYear = Number(referenceMonth.slice(0, 4)) || 2026;
    const refMo = Number(referenceMonth.slice(5, 7)) || 1;
    for (const mEntry of MONTH_NAMES) {
      if (mEntry.regex.test(working)) {
        const yearMatch = working.match(/\b(20\d{2})\b/);
        const inferredYear = yearMatch?.[1]
          ? Number(yearMatch[1])
          : mEntry.monthIndex > refMo
            ? refYear - 1
            : refYear;
        const targetMonth = `${String(inferredYear).padStart(4, "0")}-${String(mEntry.monthIndex).padStart(2, "0")}`;
        monthScope = {
          kind: "specific_month",
          month: targetMonth,
          label: `${mEntry.label}/${inferredYear}`,
        };
        working = working.replace(mEntry.regex, " ").replace(/\b20\d{2}\b/g, " ");
        break;
      }
    }
  }

  // 3. Superlativos e filtros de natureza/atributos
  if (/\b(?:maiores?\s+(?:gastos?|despesas?|compras?)|top\s+gastos?)\b/.test(working)) {
    isBiggestQuery = true;
    nature = "expense";
    working = working.replace(/\b(?:maiores?\s+(?:gastos?|despesas?|compras?)|top\s+gastos?)\b/g, " ");
  }

  if (/\b(?:despesa|despesas|gasto|gastos|compra|compras)\b/.test(working)) {
    nature = "expense";
    working = working.replace(/\b(?:despesa|despesas|gasto|gastos|compra|compras)\b/g, " ");
  } else if (/\b(?:receita|receitas|renda|rendas|entrada|entradas|proventos)\b/.test(working)) {
    nature = "income";
    working = working.replace(/\b(?:receita|receitas|renda|rendas|entrada|entradas)\b/g, " ");
  }

  if (/\b(?:parcelado|parcelada|parcelados|parceladas|parcelamento|parcelas)\b/.test(working)) {
    onlyInstallments = true;
    working = working.replace(
      /\b(?:parcelado|parcelada|parcelados|parceladas|parcelamento|parcelas)\b/g,
      " ",
    );
  }

  if (/\b(?:recorrente|recorrentes|fixo|fixa|fixos|fixas|mensalidade|mensalidades)\b/.test(working)) {
    onlyRecurring = true;
    working = working.replace(
      /\b(?:recorrente|recorrentes|fixo|fixa|fixos|fixas|mensalidade|mensalidades)\b/g,
      " ",
    );
  }

  if (/\b(?:familiar|familia|da\s+casa)\b/.test(working)) {
    onlyFamily = true;
    working = working.replace(/\b(?:familiar|familia|da\s+casa)\b/g, " ");
  }

  if (/\b(?:viagem|viagens)\b/.test(working)) {
    onlyTrips = true;
  }

  if (/\b(?:estorno|estornos|estornado|reembolso|reembolsos)\b/.test(working)) {
    onlyRefunds = true;
    working = working.replace(/\b(?:estorno|estornos|estornado|reembolso|reembolsos)\b/g, " ");
  }

  if (/\b(?:encargo|encargos|rotativo)\b/.test(working)) {
    onlyCardCharges = true;
    working = working.replace(/\b(?:encargo|encargos|rotativo)\b/g, " ");
  }

  if (/\bpix\b/.test(working)) {
    paymentMethod = "pix";
    working = working.replace(/\bpix\b/g, " ");
  } else if (/\b(?:no\s+)?(?:cartao\s+de\s+)?credito\b/.test(working)) {
    paymentMethod = "credit_card";
    working = working.replace(/\b(?:no\s+)?(?:cartao\s+de\s+)?credito\b/g, " ");
  } else if (/\b(?:no\s+)?debito\b/.test(working)) {
    paymentMethod = "debit";
    working = working.replace(/\b(?:no\s+)?debito\b/g, " ");
  } else if (/\b(?:em\s+)?dinheiro\b/.test(working)) {
    paymentMethod = "cash";
    working = working.replace(/\b(?:em\s+)?dinheiro\b/g, " ");
  }

  // 4. Tokens residuais limpos e expansões semânticas
  const rawTokens = working
    .replace(/[^\w\s*-]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !QUERY_STOPWORDS.has(tok));

  const textTokens = Array.from(new Set(rawTokens));
  const learningMap = buildLearningExpansionMap(options.merchantLearning);
  const tokenExpansions: Record<string, string[]> = {};

  for (const token of textTokens) {
    const expansions = new Set<string>([token]);
    const synList = CONCEPT_SYNONYMS_GRAPH[token];
    if (synList) {
      for (const s of synList) expansions.add(s);
    }
    const learnedBucket = learningMap.get(token);
    if (learnedBucket) {
      for (const term of learnedBucket) expansions.add(term);
    }
    // Se algum key de tag aprendida começa pelo token (>= 3 chars), expande também
    if (token.length >= 3) {
      for (const [k, terms] of learningMap.entries()) {
        if (k.includes(token)) {
          for (const t of terms) expansions.add(t);
        }
      }
    }
    tokenExpansions[token] = Array.from(expansions);
  }

  return {
    rawQuery,
    normalizedQuery,
    nature,
    paymentMethod,
    minAmountCents,
    maxAmountCents,
    onlyInstallments,
    onlyRecurring,
    onlyFamily,
    onlyTrips,
    onlyRefunds,
    onlyCardCharges,
    isBiggestQuery,
    monthScope,
    textTokens,
    tokenExpansions,
    hasAnalyticalIntent,
  };
}

/** Retorna true quando a consulta usa ao menos um operador estruturado além de texto simples. */
export function hasStructuredFilters(parsed: StructuredSearchQuery): boolean {
  return Boolean(
    parsed.nature ||
      parsed.paymentMethod ||
      parsed.minAmountCents !== undefined ||
      parsed.maxAmountCents !== undefined ||
      parsed.onlyInstallments ||
      parsed.onlyRecurring ||
      parsed.onlyFamily ||
      parsed.onlyTrips ||
      parsed.onlyRefunds ||
      parsed.onlyCardCharges ||
      parsed.monthScope !== null ||
      parsed.isBiggestQuery,
  );
}

/** Gera chips legíveis sem emojis descrevendo os filtros estruturados ativos. */
export function buildStructuredQueryBadges(parsed: StructuredSearchQuery): string[] {
  const badges: string[] = [];
  if (parsed.nature === "expense") badges.push("Despesas");
  if (parsed.nature === "income") badges.push("Receitas");
  if (parsed.minAmountCents !== undefined && parsed.maxAmountCents !== undefined) {
    badges.push(
      `${formatCentsShortBRL(parsed.minAmountCents)} a ${formatCentsShortBRL(parsed.maxAmountCents)}`,
    );
  } else if (parsed.minAmountCents !== undefined) {
    badges.push(`Acima de ${formatCentsShortBRL(parsed.minAmountCents)}`);
  } else if (parsed.maxAmountCents !== undefined) {
    badges.push(`Até ${formatCentsShortBRL(parsed.maxAmountCents)}`);
  }
  if (parsed.paymentMethod === "pix") badges.push("Pix");
  if (parsed.paymentMethod === "credit_card") badges.push("Cartão de crédito");
  if (parsed.paymentMethod === "debit") badges.push("Débito");
  if (parsed.paymentMethod === "cash") badges.push("Dinheiro");
  if (parsed.onlyInstallments) badges.push("Parcelado");
  if (parsed.onlyRecurring) badges.push("Recorrente");
  if (parsed.onlyFamily) badges.push("Familiar");
  if (parsed.onlyRefunds) badges.push("Estornos");
  if (parsed.onlyCardCharges) badges.push("Encargos");
  if (parsed.monthScope) {
    if (parsed.monthScope.kind === "today") badges.push("Hoje");
    else if (parsed.monthScope.kind === "yesterday") badges.push("Ontem");
    else if (parsed.monthScope.kind === "previous_month") badges.push("Mês passado");
    else if (parsed.monthScope.kind === "last_3_months") badges.push("Últimos 3 meses");
    else if (parsed.monthScope.kind === "specific_month") badges.push(parsed.monthScope.label);
  }
  return badges;
}

export interface StructuredMatchCandidate {
  id?: string;
  kind: "expense" | "income";
  description: string;
  categoryName?: string | null;
  cardName?: string | null;
  date: string;
  billCompetence?: string | null;
  amountCents: number;
  paymentMethod?: string | null;
  installmentsTotal?: number;
  recurrenceId?: string | null;
  isFamily?: boolean;
  tripId?: string | null;
  sourceRef?: string | null;
  chargeKind?: string | null;
  extraTerms?: readonly string[];
}

export function matchesStructuredTransactionQuery(
  candidate: StructuredMatchCandidate,
  parsed: StructuredSearchQuery,
): boolean {
  if (parsed.nature && candidate.kind !== parsed.nature) {
    return false;
  }

  const absAmount = Math.abs(candidate.amountCents);
  if (parsed.minAmountCents !== undefined && absAmount < parsed.minAmountCents) {
    return false;
  }
  if (parsed.maxAmountCents !== undefined && absAmount > parsed.maxAmountCents) {
    return false;
  }

  if (parsed.paymentMethod && candidate.paymentMethod !== parsed.paymentMethod) {
    return false;
  }

  if (parsed.onlyInstallments && !(candidate.installmentsTotal && candidate.installmentsTotal > 1)) {
    return false;
  }

  if (parsed.onlyRecurring && !candidate.recurrenceId) {
    return false;
  }

  if (parsed.onlyFamily && !candidate.isFamily) {
    return false;
  }

  if (parsed.onlyRefunds) {
    const isRef =
      candidate.amountCents < 0 ||
      Boolean(candidate.sourceRef?.toUpperCase().startsWith("[REFUND]")) ||
      normalizeQueryString(candidate.description).includes("estorno");
    if (!isRef) return false;
  }

  if (parsed.onlyCardCharges) {
    const ck = candidate.chargeKind ?? "regular";
    if (ck === "regular") return false;
  }

  if (parsed.monthScope) {
    const scope = parsed.monthScope;
    const competence =
      candidate.billCompetence && candidate.billCompetence.length >= 7
        ? candidate.billCompetence.slice(0, 7)
        : candidate.date.slice(0, 7);

    if (scope.kind === "today" || scope.kind === "yesterday") {
      if (candidate.date.slice(0, 10) !== scope.dateISO) return false;
    } else if (scope.kind === "last_3_months") {
      if (competence < scope.fromMonth || competence > scope.toMonth) return false;
    } else if (
      scope.kind === "current_month" ||
      scope.kind === "previous_month" ||
      scope.kind === "specific_month"
    ) {
      if (competence !== scope.month) return false;
    }
  }

  if (parsed.textTokens.length === 0) {
    return true;
  }

  const paymentTerms =
    candidate.paymentMethod === "credit_card" || candidate.cardName
      ? "cartao credito"
      : candidate.paymentMethod === "pix"
        ? "pix"
        : candidate.paymentMethod === "debit"
          ? "debito"
          : candidate.paymentMethod === "cash"
            ? "dinheiro"
            : "";

  const haystack = normalizeQueryString(
    [
      candidate.description,
      candidate.categoryName ?? "",
      candidate.cardName ?? "",
      paymentTerms,
      candidate.tripId ? "viagem" : "",
      ...(candidate.extraTerms ?? []),
    ].join(" "),
  );

  if (candidate.id && parsed.normalizedQuery === candidate.id.toLowerCase()) {
    return true;
  }

  return parsed.textTokens.every((token) => {
    if (token === "viagem" && candidate.tripId) {
      return true;
    }
    const variants = parsed.tokenExpansions[token] ?? [token];
    return variants.some((v) => haystack.includes(v));
  });
}
