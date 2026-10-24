import type { TourStep, TourTrackId } from "./types";

export const TOUR_STEPS: Record<TourTrackId, TourStep[]> = {
  finances: [
    {
      id: "finances-overview",
      track: "finances",
      order: 1,
      title: "Visão Geral & Fluxo Consolidado",
      description:
        "Monitore seu saldo livre real, ritmo de gastos e fluxo diário do mês corrente com total clareza.",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 4",
      actionLabel: "Explorar Dashboard",
    },
    {
      id: "finances-transactions",
      track: "finances",
      order: 2,
      title: "Lançamentos & Categorização",
      description:
        "Acompanhe receitas e despesas organizadas por categoria, com suporte a parcelas e conciliação.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="transactions-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 4",
      actionLabel: "Ver Transações",
    },
    {
      id: "finances-cards",
      track: "finances",
      order: 3,
      title: "Cartões & Faturas Inteligentes",
      description:
        "Visualize faturas abertas, limite disponível e parcelas futuras organizadas por competência.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 4",
      actionLabel: "Ver Cartões",
    },
    {
      id: "finances-budgets",
      track: "finances",
      order: 4,
      title: "Orçamentos & Metas de Gastos",
      description:
        "Defina tetos por categoria e receba alertas de ritmo antes de estourar seu orçamento mensal.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 4 de 4",
      actionLabel: "Ver Orçamentos",
    },
  ],
  investments: [
    {
      id: "investments-overview",
      track: "investments",
      order: 1,
      title: "Visão Patrimonial Consolidada",
      description:
        "Acompanhe a distribuição global do seu patrimônio entre renda fixa, ações, fundos imobiliários e cripto.",
      targetRoute: "/investimentos",
      targetSelector: '[data-tour="investments-summary"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Ver Carteira",
    },
    {
      id: "investments-targets",
      track: "investments",
      order: 2,
      title: "Metas de Alocação por Classe & Ativo",
      description:
        "Defina os percentuais ideais para cada classe e ativo para guiar seus aportes sem viés emocional.",
      targetRoute: "/investimentos?tab=metas",
      targetSelector: '[data-tour="investments-targets"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Metas",
    },
    {
      id: "investments-rebalance",
      track: "investments",
      order: 3,
      title: "Calculadora de Aporte Inteligente",
      description:
        "Informe quanto deseja investir e o motor matemático calcula exatamente onde alocar para rebalancear.",
      targetRoute: "/investimentos?tab=aporte",
      targetSelector: '[data-tour="investments-rebalance"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Calcular Aporte",
    },
  ],
};

/** Retorna os passos ordenados da trilha selecionada. */
export function getTourSteps(track: TourTrackId): TourStep[] {
  return TOUR_STEPS[track] ?? [];
}
