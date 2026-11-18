export interface FabAction {
  to: string;
  label: string;
}

/**
 * Resolve a ação contextual do FAB central de acordo com a rota ativa e permissões do usuário.
 * 1. Prioriza o contexto local (Viagens, Detalhes da Viagem, Família, Metas, Orçamentos, Dívidas, Investimentos, Cartões, Transações).
 * 2. Em páginas neutras, aplica o fallback dinâmico por módulo habilitado.
 */
export function resolveFabAction(
  pathname: string,
  search: string,
  hasFeature: (key: string) => boolean,
): FabAction | null {
  const params = new URLSearchParams(search);
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  // --- 1. Ações Contextuais Locais ---

  // Detalhes de uma Viagem (/viagens/:id)
  if (/^\/viagens\/[^/]+$/.test(normalizedPath) && hasFeature("transactions")) {
    params.set("novo", "gasto-viagem");
    return { to: `${normalizedPath}?${params.toString()}`, label: "Novo Gasto da Viagem" };
  }

  // Hub de Viagens (/viagens)
  if (normalizedPath === "/viagens" && hasFeature("transactions")) {
    params.set("novo", "viagem");
    return { to: `${normalizedPath}?${params.toString()}`, label: "Nova Viagem" };
  }

  // Modo Família (/familia ou /modo-familia)
  if ((normalizedPath === "/familia" || normalizedPath === "/modo-familia") && hasFeature("transactions")) {
    params.set("novo", "despesa");
    params.set("familia", "1");
    return { to: `${normalizedPath}?${params.toString()}`, label: "Nova despesa familiar" };
  }

  // Página de Dívidas & Empréstimos
  if (normalizedPath === "/dividas" && hasFeature("debts")) {
    params.set("novo", "divida");
    return { to: `${normalizedPath}?${params.toString()}`, label: "Nova dívida" };
  }

  // Metas & Campanhas (/metas ou /orcamentos?tab=goals) — M8
  const isGoalsTab =
    params.get("tab") === "goals" ||
    params.get("aba") === "metas" ||
    params.get("type") === "income";
  if (
    (normalizedPath === "/metas" || (normalizedPath === "/orcamentos" && isGoalsTab)) &&
    hasFeature("budgets")
  ) {
    params.set("novo", "meta");
    return { to: `${normalizedPath}?${params.toString()}`, label: "Nova Meta" };
  }

  // Orçamentos & Categorias
  if ((normalizedPath === "/orcamentos" || normalizedPath === "/categorias") && hasFeature("budgets")) {
    params.set("novo", "categoria");
    return { to: `${normalizedPath}?${params.toString()}`, label: "Nova categoria" };
  }

  // Investimentos & Carteira
  if (
    (normalizedPath === "/investments" ||
      normalizedPath === "/investimentos" ||
      normalizedPath === "/carteira") &&
    hasFeature("investments")
  ) {
    params.set("novo", "investimento");
    return { to: `${normalizedPath}?${params.toString()}`, label: "Novo investimento" };
  }

  // Cartões, Transações e Início
  if (
    (normalizedPath === "/cartoes" || normalizedPath === "/transacoes" || normalizedPath === "/") &&
    hasFeature("transactions")
  ) {
    params.set("novo", "transacao");
    return { to: `${normalizedPath}?${params.toString()}`, label: "Nova transação" };
  }

  // --- 2. Fallback Dinâmico Prioritário ---
  if (hasFeature("transactions")) {
    params.set("novo", "transacao");
    return { to: `${pathname}?${params.toString()}`, label: "Nova transação" };
  }

  if (hasFeature("investments")) {
    return { to: "/investments?novo=investimento", label: "Novo investimento" };
  }

  if (hasFeature("debts")) {
    return { to: "/dividas?novo=divida", label: "Nova dívida" };
  }

  if (hasFeature("budgets")) {
    return { to: "/orcamentos?novo=categoria", label: "Nova categoria" };
  }

  return null;
}
