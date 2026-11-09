/**
 * Parser Léxico Determinístico e Resolução de Intenções de Busca em pt-BR.
 * ESPECIFICAÇÃO TÉCNICA §3.9, Plano 12 (Fase 3) & Quality Gate QG4.
 *
 * Resolução pura em memória (< 2ms) sobre agregados locais.
 * Zero dependência de LLM ou chamadas externas de rede.
 */

import { todayISO as getTodayISO } from "@/domain/debts";

export type SearchIntentKind =
  | "category_spending"
  | "upcoming_due"
  | "balance_and_reserve"
  | "system_action";

export interface SearchIntentContext {
  todayISO: string; // YYYY-MM-DD
  /** Gastos por nome/slug de categoria normalizada em centavos no mês atual */
  categorySpendingCurrentMonth?: Record<string, number>;
  /** Gastos no mês anterior */
  categorySpendingPreviousMonth?: Record<string, number>;
  /** Contas e faturas a vencer nos próximos dias */
  upcomingBills?: Array<{
    title: string;
    amountCents: number;
    dueDate: string;
    isOverdue: boolean;
  }>;
  /** Saldo total disponível em contas (centavos) */
  availableBalanceCents?: number;
  /** Reserva de emergência acumulada (centavos) */
  emergencyReserveCents?: number;
}

export interface SearchIntentResult {
  kind: SearchIntentKind;
  matchedQuery: string;
  title: string;
  headline: string;
  detail?: string;
  action?: {
    label: string;
    path: string;
    params?: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// Dicionário de Sinônimos e Categorias
// ---------------------------------------------------------------------------

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  alimentacao: ["alimentacao", "comida", "mercado", "supermercado", "restaurante", "almoco", "jantar", "ifood", "lanche"],
  transporte: ["transporte", "uber", "combustivel", "gasolina", "estacionamento", "onibus", "metro", "pedagio"],
  moradia: ["moradia", "casa", "aluguel", "condominio", "luz", "energia", "agua", "internet", "gas"],
  lazer: ["lazer", "entretenimento", "viagem", "cinema", "passeio", "jogos", "shows", "bar", "festas"],
  saude: ["saude", "farmacia", "medicamento", "medico", "consulta", "exames", "dentista", "hospital"],
  educacao: ["educacao", "curso", "faculdade", "escola", "livro", "mensalidade"],
  compras: ["compras", "shopping", "roupas", "vestuario", "eletronicos", "presentes"],
  assinaturas: ["assinaturas", "streaming", "netflix", "spotify", "mensalidades", "servicos"],
  outros: ["outros", "geral", "diversos"],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const STOP_WORDS = new Set(["o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "com", "por", "para", "foi", "e", "que", "se", "eu", "meu", "minha", "quanto", "total", "gasto", "gastos", "gastei", "valor", "mes", "ano", "hoje"]);

function resolveCanonicalCategory(inputWord: string): string | null {
  const norm = normalizeText(inputWord);
  if (norm.length < 3 || STOP_WORDS.has(norm)) return null;

  for (const [canonical, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    // 1. Match exato
    if (synonyms.some((syn) => norm === syn)) {
      return canonical;
    }
    // 2. Prefixo (ex: "supermercados" -> "supermercado", "transporte" -> "transportes")
    if (synonyms.some((syn) => syn.startsWith(norm) || norm.startsWith(syn))) {
      return canonical;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Regex Determinísticos
// ---------------------------------------------------------------------------

// 1. Gasto por Categoria
// Exemplos: "quanto gastei com alimentacao", "total de compras mes", "valor mercado", "gastei com lazer"
const REGEX_CATEGORY_SPENDING =
  /^(quanto\s+(eu\s+)?gastei|total\s+(de\s+|com\s+|em\s+)?|gasto(s)?\s+(com\s+|de\s+|em\s+)?|valor\s+(com\s+|de\s+|em\s+)?|gastei\s+(com\s+|em\s+)?)(.*)$/i;

// 2. Vencimentos Próximos
// Exemplos: "faturas vencendo", "contas a pagar", "proximos boletos", "vencimentos", "o que vence hoje"
const REGEX_UPCOMING_DUE =
  /(faturas?|contas?|vencend|a pagar|boletos?|vencimento|o que vence|proximos vencimentos)/i;

// 3. Saldo e Reserva
// Exemplos: "qual meu saldo", "quanto tenho", "saldo disponivel", "reserva de emergencia", "quanto tenho guardado"
const REGEX_BALANCE_RESERVE =
  /(saldo|quanto\s+tenho|disponivel|reserva(\s+de\s+emergencia)?|patrimonio\s+liquido|quanto\s+sobrou)/i;

// 4. Ações do Sistema
// Exemplos: "nova despesa", "novo gasto", "criar receita", "adicionar cartao", "lancar despesa", "nova meta"
const REGEX_SYSTEM_ACTION =
  /(novo|nova|criar|adicionar|lançar|lancar)\s+(gasto|despesa|receita|renda|cart[aã]o|meta|divida|orcamento)/i;

/**
 * Avalia se a query do usuário expressa uma intenção direta do usuário e
 * devolve uma resposta imediata (< 2ms) calculada sobre os dados em cache.
 */
export function resolveSearchIntent(
  rawQuery: string,
  context: SearchIntentContext = { todayISO: getTodayISO() },
): SearchIntentResult | null {
  const query = rawQuery.trim();
  if (query.length < 3) return null;

  const normalized = normalizeText(query);

  // 1. Ações do Sistema
  const actionMatch = normalized.match(REGEX_SYSTEM_ACTION);
  if (actionMatch && actionMatch[2]) {
    const actionTarget = normalizeText(actionMatch[2]);
    if (actionTarget.includes("gasto") || actionTarget.includes("despesa")) {
      return {
        kind: "system_action",
        matchedQuery: rawQuery,
        title: "Ação Rápida",
        headline: "Registrar Nova Despesa",
        detail: "Abrir formulário de lançamento de saída",
        action: { label: "Nova Despesa", path: "/transacoes", params: { action: "new-expense" } },
      };
    }
    if (actionTarget.includes("receita") || actionTarget.includes("renda")) {
      return {
        kind: "system_action",
        matchedQuery: rawQuery,
        title: "Ação Rápida",
        headline: "Registrar Nova Receita",
        detail: "Abrir formulário de lançamento de entrada",
        action: { label: "Nova Receita", path: "/transacoes", params: { action: "new-income" } },
      };
    }
    if (actionTarget.includes("cartao")) {
      return {
        kind: "system_action",
        matchedQuery: rawQuery,
        title: "Ação Rápida",
        headline: "Cadastrar Novo Cartão de Crédito",
        detail: "Adicionar cartão e gerenciar limites e faturas",
        action: { label: "Novo Cartão", path: "/cartoes", params: { action: "new-card" } },
      };
    }
    if (actionTarget.includes("meta")) {
      return {
        kind: "system_action",
        matchedQuery: rawQuery,
        title: "Ação Rápida",
        headline: "Criar Nova Meta Financeira",
        detail: "Definir objetivo e conectar termômetro patrimonial",
        action: { label: "Nova Meta", path: "/orcamentos", params: { action: "new-goal" } },
      };
    }
    if (actionTarget.includes("divida")) {
      return {
        kind: "system_action",
        matchedQuery: rawQuery,
        title: "Ação Rápida",
        headline: "Cadastrar Empréstimo ou Dívida",
        detail: "Registrar contrato ou financiamento",
        action: { label: "Nova Dívida", path: "/dividas", params: { action: "new-debt" } },
      };
    }
    if (actionTarget.includes("orcamento")) {
      return {
        kind: "system_action",
        matchedQuery: rawQuery,
        title: "Ação Rápida",
        headline: "Definir Limite de Orçamento",
        detail: "Configurar teto de gastos por categoria",
        action: { label: "Novo Orçamento", path: "/orcamentos", params: { action: "new-budget" } },
      };
    }
  }

  // 2. Saldo e Reserva
  if (REGEX_BALANCE_RESERVE.test(normalized)) {
    const isReserve = normalized.includes("reserva");
    if (isReserve) {
      const reserve = context.emergencyReserveCents ?? 0;
      return {
        kind: "balance_and_reserve",
        matchedQuery: rawQuery,
        title: "Reserva de Emergência",
        headline: `Reserva Guardada: ${formatCentsToBRL(reserve)}`,
        detail: "Alocada em liquidez diária e metas de reserva",
        action: { label: "Ver Reserva & Metas", path: "/orcamentos" },
      };
    }

    const balance = context.availableBalanceCents ?? 0;
    return {
      kind: "balance_and_reserve",
      matchedQuery: rawQuery,
      title: "Saldo Disponível",
      headline: `Saldo Livre Total: ${formatCentsToBRL(balance)}`,
      detail: "Soma das contas correntes deduzidas pendências",
      action: { label: "Ver Visão Geral", path: "/visao-geral" },
    };
  }

  // 3. Vencimentos Próximos
  if (REGEX_UPCOMING_DUE.test(normalized)) {
    const bills = context.upcomingBills ?? [];
    const count = bills.length;
    const totalCents = bills.reduce((acc, b) => acc + b.amountCents, 0);

    if (count === 0) {
      return {
        kind: "upcoming_due",
        matchedQuery: rawQuery,
        title: "Vencimentos Próximos",
        headline: "Nenhum boleto ou fatura pendente para os próximos dias",
        detail: "Todas as suas obrigações mapeadas estão em dia",
        action: { label: "Central de Lembretes", path: "/lembretes" },
      };
    }

    const first = bills[0];
    return {
      kind: "upcoming_due",
      matchedQuery: rawQuery,
      title: "Vencimentos Próximos",
      headline: `${count} conta${count > 1 ? "s" : ""} a vencer: ${formatCentsToBRL(totalCents)}`,
      detail: first
        ? `Próximo: ${first.title} (${formatCentsToBRL(first.amountCents)}) em ${first.dueDate}`
        : undefined,
      action: { label: "Ver Todos os Lembretes", path: "/lembretes" },
    };
  }

  // 4. Gasto por Categoria
  const catMatch = normalized.match(REGEX_CATEGORY_SPENDING);
  if (catMatch || normalized.startsWith("quanto ") || normalized.startsWith("total ")) {
    // Procura palavra-chave de categoria no texto da consulta
    const words = normalized.split(/\s+/);
    for (const w of words) {
      const canonical = resolveCanonicalCategory(w);
      if (canonical) {
        const spendingMap = context.categorySpendingCurrentMonth ?? {};
        const spentCents = spendingMap[canonical] ?? 0;
        const displayName = canonical.charAt(0).toUpperCase() + canonical.slice(1);

        return {
          kind: "category_spending",
          matchedQuery: rawQuery,
          title: `Gasto em ${displayName}`,
          headline: `${formatCentsToBRL(spentCents)} no mês atual`,
          detail: `Total consolidado de despesas na categoria ${displayName}`,
          action: {
            label: "Ver Extrato da Categoria",
            path: "/transacoes",
            params: { categoria: canonical },
          },
        };
      }
    }
  }

  return null;
}
