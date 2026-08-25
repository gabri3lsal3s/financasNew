/**
 * Busca global & Command Palette (⌘K) — ESPECIFICAÇÃO §3.9 e Fase 64.
 *
 * Gatilho: query com ≥ 2 caracteres; busca universal em 100% dos módulos:
 *   • Páginas do sistema e Navegação rápida;
 *   • Ações operacionais rápidas em 1 clique;
 *   • Investimentos (Tickers B3/EUA, Tesouro, CDBs, Cripto);
 *   • Transações (despesas e receitas);
 *   • Dívidas e Empréstimos;
 *   • Cartões de Crédito;
 *   • Orçamentos e Metas por Categoria;
 *   • Lembretes e Recorrências;
 *   • Categorias de Despesa e Renda.
 *
 *   • Normalização NFD: remove acentos e converte para minúsculas;
 *   • Multi-token matching: decomposição por espaço com correspondência completa;
 *   • Scoring por tipo de match: igual 100 / prefixo 85 / contém 60 / multi-token 75;
 *     match numérico (valor) 30; match de status 40;
 *   • Bônus de recência logarítmico: mês atual +25, 1–2m +20, 3–4m +15,
 *     5–6m +10, 7–12m +5, 12m+ +0;
 *   • Limites: máx. 5 por tipo e 16 no total; ordenação por score desc;
 *   • Deep-link: cada resultado carrega a rota + params correspondente.
 *
 * Motor puro — sem import de UI/Supabase; testável isoladamente.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type SearchEntryType =
  | "action"
  | "page"
  | "investment"
  | "expense"
  | "income"
  | "debt"
  | "card"
  | "budget"
  | "reminder"
  | "category";

export interface SearchEntry {
  id: string;
  type: SearchEntryType;
  /** Textos buscáveis (descrição, nome, categoria, forma, tipo, aliases…). */
  text: string[];
  /** Valor numérico em centavos (match numérico = 30). */
  amountCents?: number;
  /** Data (YYYY-MM-DD) — base do bônus de recência. */
  date?: string;
  /** Palavras de status (ex.: dívida "vencida") — match = +40. */
  statusWords?: string[];
  /** Rótulo principal exibido. */
  label: string;
  /** Rótulo secundário (categoria, data, forma, rota…). */
  detail?: string;
  /** Deep-link: rota + params (ex.: /transacoes?month=…&q=…). */
  link: { path: string; params?: Record<string, string> };
}

export interface SearchResult {
  entry: SearchEntry;
  score: number;
}

export interface SearchLimits {
  /** Máximo de resultados por tipo (default 5). */
  maxPerType?: number;
  /** Máximo total de resultados (default 16). */
  maxTotal?: number;
}

// ---------------------------------------------------------------------------
// Normalização e scoring
// ---------------------------------------------------------------------------

/** Remove acentos e converte para minúsculas (matching §3.9). */
export function normalizeSearch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Score por tipo de match direto: igual 100 / prefixo 85 / contém 60. */
export function matchScore(query: string, haystack: string): number {
  if (haystack === query) return 100;
  if (haystack.startsWith(query)) return 85;
  if (haystack.includes(query)) return 60;
  return 0;
}

/** Match numérico: dígitos da query batem com o valor em reais (30). */
export function numericMatchScore(query: string, amountCents: number): number {
  const queryDigits = query.replace(/\D/g, "");
  if (queryDigits.length < 2) return 0;
  const amount = String(Math.max(0, Math.round(amountCents / 100)));
  return amount.includes(queryDigits) ? 30 : 0;
}

/** Meses decorridos entre uma data (YYYY-MM-DD) e hoje (YYYY-MM-DD). */
export function monthsBetween(dateISO: string, today: string): number {
  const [year, month] = dateISO.split("-").map(Number);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const diff = ((todayYear ?? 0) - (year ?? 0)) * 12 + ((todayMonth ?? 1) - (month ?? 1));
  return Math.max(0, diff);
}

/** Bônus de recência logarítmico (§3.9): mês atual +25 … 12m+ +0. */
export function recencyBonus(monthsAgo: number): number {
  if (monthsAgo === 0) return 25;
  if (monthsAgo <= 2) return 20;
  if (monthsAgo <= 4) return 15;
  if (monthsAgo <= 6) return 10;
  if (monthsAgo <= 12) return 5;
  return 0;
}

/** Score multi-token: verifica se todos os tokens da query estão presentes no conjunto de textos. */
export function multiTokenMatchScore(tokens: readonly string[], haystacks: readonly string[]): number {
  if (tokens.length <= 1) return 0;
  const normalizedHaystacks = haystacks.map(normalizeSearch);
  const allTokensMatch = tokens.every((token) =>
    normalizedHaystacks.some((haystack) => haystack.includes(token)),
  );
  return allTokensMatch ? 75 : 0;
}

/** Score total de um registro: texto + multi-token + numérico + status + recência. */
export function scoreSearchEntry(query: string, entry: SearchEntry, today: string): number {
  const normalized = normalizeSearch(query);
  if (normalized.length < 2) return 0;

  const tokens = normalized.split(/\s+/).filter((t) => t.length > 0);

  let score = 0;
  for (const text of entry.text) {
    score = Math.max(score, matchScore(normalized, normalizeSearch(text)));
  }

  // Se a query tem múltiplos tokens, avalia a correspondência combinada
  if (tokens.length > 1) {
    const combinedTexts = [...entry.text, ...(entry.statusWords ?? []), entry.label, entry.detail ?? ""];
    const tokenScore = multiTokenMatchScore(tokens, combinedTexts);
    score = Math.max(score, tokenScore);
  }

  if (entry.amountCents !== undefined && numericMatchScore(normalized, entry.amountCents) > 0) {
    score += 30;
  }
  if (entry.statusWords !== undefined && entry.statusWords.some((word) => normalizeSearch(word).includes(normalized))) {
    score += 40;
  }

  // Prioridade suave para Ações Rápidas e Páginas quando há correspondência
  if (score > 0 && entry.type === "action") {
    score += 15;
  } else if (score > 0 && entry.type === "page") {
    score += 10;
  }

  // Bônus de recência só vale com um match base (texto/numérico/status)
  if (score > 0 && entry.date) {
    score += recencyBonus(monthsBetween(entry.date, today));
  }
  return score;
}

// ---------------------------------------------------------------------------
// Catálogo Estático de Páginas e Ações Rápidas
// ---------------------------------------------------------------------------

export const STATIC_APP_PAGE_ENTRIES: readonly SearchEntry[] = [
  {
    id: "page-overview",
    type: "page",
    text: ["inicio", "dashboard", "visao geral", "resumo financeiro", "home"],
    label: "Início / Visão Geral",
    detail: "Dashboard consolidado e saldo atual",
    link: { path: "/" },
  },
  {
    id: "page-transactions",
    type: "page",
    text: ["transacoes", "extrato", "despesas", "receitas", "rendas", "lancamentos"],
    label: "Extrato de Transações",
    detail: "Histórico completo de receitas e despesas",
    link: { path: "/transacoes" },
  },
  {
    id: "page-cards",
    type: "page",
    text: ["cartoes", "cartao de credito", "faturas", "limites", "parcelamentos"],
    label: "Cartões de Crédito",
    detail: "Faturas, limites e gestão de cartões",
    link: { path: "/cartoes" },
  },
  {
    id: "page-investments",
    type: "page",
    text: ["investimentos", "carteira", "patrimonio", "acoes", "fiis", "renda fixa", "tesouro"],
    label: "Investimentos & Carteira",
    detail: "Custódia consolidada e rentabilidade",
    link: { path: "/investimentos" },
  },
  {
    id: "page-investments-aporte",
    type: "page",
    text: ["rebalanceamento", "calculadora de aporte", "onde investir", "balanceamento"],
    label: "Rebalanceamento & Aporte",
    detail: "Motor de sugestão de aportes por desvio",
    link: { path: "/investimentos", params: { tab: "aporte" } },
  },
  {
    id: "page-investments-proventos",
    type: "page",
    text: ["proventos", "dividendos", "rendimentos", "jcp", "yield on cost"],
    label: "Proventos & Dividendos",
    detail: "Histórico de rendimentos e bola de neve",
    link: { path: "/investimentos", params: { tab: "proventos" } },
  },
  {
    id: "page-investments-targets",
    type: "page",
    text: ["metas de alocacao", "metas por classe", "metas por setor", "alocacao ideal"],
    label: "Metas de Alocação",
    detail: "Definição de metas por classe e ativos",
    link: { path: "/investimentos", params: { tab: "targets" } },
  },
  {
    id: "page-debts",
    type: "page",
    text: ["dividas", "emprestimos", "financiamentos", "a pagar", "a receber"],
    label: "Dívidas & Empréstimos",
    detail: "Controle de dívidas ativas e acordos",
    link: { path: "/dividas" },
  },
  {
    id: "page-budgets",
    type: "page",
    text: ["orcamentos", "metas de gastos", "teto de gastos", "limites por categoria"],
    label: "Orçamentos & Metas de Gastos",
    detail: "Limites mensais por categoria de consumo",
    link: { path: "/orcamentos" },
  },
  {
    id: "page-categories",
    type: "page",
    text: ["categorias", "gerenciar categorias", "personalizar categorias"],
    label: "Categorias",
    detail: "Classificação de receitas e despesas",
    link: { path: "/categorias" },
  },
  {
    id: "page-reports",
    type: "page",
    text: ["relatorios", "relatorio executivo", "graficos", "analise financeira"],
    label: "Relatórios & Análises",
    detail: "Visão analítica de evolução e distribuição",
    link: { path: "/relatorios" },
  },
  {
    id: "page-reports-dre",
    type: "page",
    text: ["dre", "demonstrativo", "dre contabil", "resultado do exercicio"],
    label: "DRE Contábil Gerencial",
    detail: "Demonstrativo estruturado de receitas e despesas",
    link: { path: "/relatorios", params: { tab: "dre" } },
  },
  {
    id: "page-reports-patrimonio",
    type: "page",
    text: ["tear sheet", "patrimonio liquido", "evolucao patrimonial", "balanco patrimonial"],
    label: "Tear Sheet de Patrimônio",
    detail: "Evolução histórica de ativos e passivos",
    link: { path: "/relatorios", params: { tab: "patrimonio" } },
  },
  {
    id: "page-reports-irpf",
    type: "page",
    text: ["irpf", "imposto de renda", "declaracao anual", "informe de rendimentos"],
    label: "Facilitador de IRPF Anual",
    detail: "Dossiê fiscal para Declaração de Ajuste Anual",
    link: { path: "/relatorios", params: { tab: "irpf" } },
  },
  {
    id: "page-reports-projecao",
    type: "page",
    text: ["projecao", "cenarios futuros", "simulacao financeira", "independencia financeira"],
    label: "Projeção Financeira",
    detail: "Simulações e projeções de longo prazo",
    link: { path: "/relatorios", params: { tab: "projecao" } },
  },
  {
    id: "page-insights",
    type: "page",
    text: ["insights", "alertas", "diagnosticos", "dicas", "notificacoes"],
    label: "Insights & Alertas",
    detail: "Diagnósticos automáticos sobre suas finanças",
    link: { path: "/insights" },
  },
  {
    id: "page-reminders",
    type: "page",
    text: ["lembretes", "recorrencias", "contas a vencer", "assinaturas"],
    label: "Lembretes & Recorrências",
    detail: "Contas fixas e lembretes de vencimento",
    link: { path: "/lembretes" },
  },
  {
    id: "page-settings",
    type: "page",
    text: ["configuracoes", "preferencias", "perfil", "conta", "tema", "exportar"],
    label: "Configurações da Conta",
    detail: "Preferências de exibição, tema e dados",
    link: { path: "/configuracoes" },
  },
];

export const STATIC_APP_ACTION_ENTRIES: readonly SearchEntry[] = [
  {
    id: "action-new-expense",
    type: "action",
    text: ["nova despesa", "lancar despesa", "gasto", "comprar", "pagar"],
    label: "Nova Despesa",
    detail: "Lançar nova despesa ou compra com cartão/PIX",
    link: { path: "/transacoes", params: { action: "new-expense" } },
  },
  {
    id: "action-new-income",
    type: "action",
    text: ["nova receita", "lancar renda", "salario", "receber", "deposito"],
    label: "Nova Receita",
    detail: "Registrar entrada financeira ou salário",
    link: { path: "/transacoes", params: { action: "new-income" } },
  },
  {
    id: "action-new-asset",
    type: "action",
    text: ["novo ativo", "adicionar ativo", "cadastrar investimento", "comprar acao", "comprar fii", "aplicar renda fixa"],
    label: "Novo Ativo / Aporte na Carteira",
    detail: "Cadastrar nova posição ou registrar aporte",
    link: { path: "/investimentos", params: { action: "new-asset" } },
  },
  {
    id: "action-new-card",
    type: "action",
    text: ["novo cartao", "adicionar cartao", "cadastrar cartao de credito"],
    label: "Novo Cartão de Crédito",
    detail: "Cadastrar novo cartão e configurar limite/fechamento",
    link: { path: "/cartoes", params: { action: "new-card" } },
  },
  {
    id: "action-new-debt",
    type: "action",
    text: ["nova divida", "adicionar emprestimo", "registrar divida"],
    label: "Nova Dívida / Empréstimo",
    detail: "Cadastrar obrigação a pagar ou crédito a receber",
    link: { path: "/dividas", params: { action: "new-debt" } },
  },
  {
    id: "action-new-budget",
    type: "action",
    text: ["novo orcamento", "definir teto", "limite de gasto", "criar orcamento"],
    label: "Novo Orçamento Mensal",
    detail: "Definir teto de gastos para uma categoria",
    link: { path: "/orcamentos", params: { action: "new-budget" } },
  },
  {
    id: "action-new-reminder",
    type: "action",
    text: ["novo lembrete", "adicionar recorrencia", "agendar conta"],
    label: "Novo Lembrete / Recorrência",
    detail: "Criar lembrete de conta a pagar ou receber",
    link: { path: "/lembretes", params: { action: "new-reminder" } },
  },
  {
    id: "action-export-executive-report",
    type: "action",
    text: ["imprimir relatorio", "exportar pdf", "dossie executivo", "baixar pdf"],
    label: "Exportar Dossiê Executivo (PDF)",
    detail: "Gerar relatório financeiro diagramado A4",
    link: { path: "/relatorios", params: { action: "print-executive" } },
  },
  {
    id: "action-export-irpf-report",
    type: "action",
    text: ["imprimir irpf", "dossie fiscal pdf", "exportar imposto de renda"],
    label: "Exportar Dossiê Fiscal IRPF (PDF)",
    detail: "Gerar informe fiscal para declaração anual",
    link: { path: "/relatorios", params: { tab: "irpf", action: "print-tax" } },
  },
];

// ---------------------------------------------------------------------------
// Busca consolidada
// ---------------------------------------------------------------------------

/**
 * Executa a busca global: pontua todos os registros, aplica o bônus de
 * recência, respeita os limites (máx. por tipo e total) e ordena por score
 * decrescente (desempate alfabético). Query com < 2 caracteres → vazio.
 */
export function searchGlobal(
  query: string,
  entries: readonly SearchEntry[],
  today: string,
  limits: SearchLimits = {},
): SearchResult[] {
  const { maxPerType = 5, maxTotal = 16 } = limits;
  const normalized = normalizeSearch(query);
  if (normalized.length < 2) return [];

  const scored = entries
    .map((entry) => ({ entry, score: scoreSearchEntry(normalized, entry, today) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, "pt-BR"));

  const perType = new Map<SearchEntryType, number>();
  const results: SearchResult[] = [];
  for (const { entry, score } of scored) {
    if (results.length >= maxTotal) break;
    const count = perType.get(entry.type) ?? 0;
    if (count >= maxPerType) continue;
    perType.set(entry.type, count + 1);
    results.push({ entry, score });
  }
  return results;
}
