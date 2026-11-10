import type { TourStep, TourTrackId } from "./types";

export const TOUR_STEPS: Record<TourTrackId, TourStep[]> = {
  // Trilha Principal 1: Finanças Diárias Consolidado e Didático (5 passos essenciais integrados)
  finances: [
    {
      id: "finances-overview",
      track: "finances",
      order: 1,
      title: "Dashboard & Saldo Livre Real",
      description:
        "Monitore seu saldo livre real descontando faturas e despesas já comprometidas no mês, com visão patrimonial de caixa clara.",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
      fallbackSelectors: ['[data-tour="overview-hero"]'],
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 5",
      actionLabel: "Próximo",
    },
    {
      id: "finances-wizard-btn",
      track: "finances",
      order: 2,
      title: "O Botão Wizard (+) e Atalhos",
      titleDesktop: "Comandos Rápidos & Atalho (Ctrl+K)",
      description:
        "O botão de destaque central na barra inferior (ou atalhos no topo) permite registrar despesas, receitas ou transferências com agilidade.",
      contentDesktop:
        "No desktop, acione a barra de comandos ou utilize o atalho Ctrl+K para registrar despesas, receitas ou navegar rapidamente por qualquer recurso.",
      targetRoute: "/",
      targetSelector: '[data-tour="bottom-nav-wizard"]',
      targetSelectorDesktop: '[data-tour="desktop-new-transaction"]',
      fallbackSelectors: ['[data-tour="desktop-new-transaction"]', '[data-tour="bottom-nav-wizard"]'],
      preferredPlacement: "top",
      spotlightPadding: 10,
      spotlightBorderRadius: 9999,
      badgeLabel: "Passo 2 de 5",
      actionLabel: "Ver Extrato",
    },
    {
      id: "finances-transactions",
      track: "finances",
      order: 3,
      title: "Extrato Unificado & Filtros",
      description:
        "Visão cronológica com separação de parcelas, conciliação e filtros detalhados por período e categoria.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="transactions-feed-card"]',
      fallbackSelectors: ['[data-tour="transactions-content"]'],
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 5",
      actionLabel: "Ver Cartões",
    },
    {
      id: "finances-cards",
      track: "finances",
      order: 4,
      title: "Cartões, Faturas e Limites",
      description:
        "Visualize faturas abertas, limite disponível, melhor dia de compra e acompanhe as competências de cada cartão.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-invoice-summary"]',
      fallbackSelectors: ['[data-tour="cards-content"]'],
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 4 de 5",
      actionLabel: "Ver Orçamentos",
    },
    {
      id: "finances-budgets",
      track: "finances",
      order: 5,
      title: "Categorias & Tetos Mensais",
      description:
        "Defina limites por categoria e acompanhe barras de ritmo para saber se o consumo diário está dentro do planejado.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      fallbackSelectors: ['[data-tour="budgets-card"]'],
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 5 de 5",
      actionLabel: "Começar",
    },
  ],

  // Trilha Principal 2: Investimentos & Rebalanceamento Consolidado (5 passos integrados)
  investments: [
    {
      id: "investments-overview",
      track: "investments",
      order: 1,
      title: "Visão Patrimonial Global",
      description:
        "Acompanhe a distribuição global por classes (Renda Fixa, Ações, FIIs, Cripto), saldo em corretora e evolução patrimonial.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-summary"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 5",
      actionLabel: "Próximo",
    },
    {
      id: "investments-new-op",
      track: "investments",
      order: 2,
      title: "Cadastro de Ativo (Nova Operação)",
      description:
        "Cadastre novos ativos informando quantidade, preço médio e corretora para manter sua carteira sempre atualizada.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-new-op"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 5",
      actionLabel: "Ver Metas",
    },
    {
      id: "investments-targets",
      track: "investments",
      order: 3,
      title: "Metas Estratégicas de Alocação",
      description:
        "Defina os percentuais ideais para cada classe e ativo para calibrar a exposição e guiar seus aportes sem viés emocional.",
      targetRoute: "/investments?tab=metas",
      targetSelector: '[data-tour="investments-targets"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 5",
      actionLabel: "Ver Aporte",
    },
    {
      id: "investments-rebalance",
      track: "investments",
      order: 4,
      title: "Calculadora de Aporte Inteligente",
      description:
        "Informe quanto deseja investir e o motor matemático calcula exatamente onde alocar para rebalancear sem vender posições.",
      targetRoute: "/investments?tab=aporte",
      targetSelector: '[data-tour="investments-rebalance"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 4 de 5",
      actionLabel: "Ver Proventos",
    },
    {
      id: "investments-dividends",
      track: "investments",
      order: 5,
      title: "Proventos & Renda Passiva",
      description:
        "Acompanhe dividendos, JCP e rendimentos de FIIs recebidos e provisionados para medir o efeito bola de neve da carteira.",
      targetRoute: "/investments?tab=proventos",
      targetSelector: '[data-tour="investments-dividends"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 5 de 5",
      actionLabel: "Concluir",
    },
  ],

  // Trilha Principal 3: Finanças Compartilhadas & Modo Família Consolidado (4 passos integrados)
  shared_finances: [
    {
      id: "shared-wizard-split-toggle",
      track: "shared_finances",
      order: 1,
      title: "Lançamento Compartilhado e Modo Família",
      titleDesktop: "Lançamento Compartilhado e Modo Família",
      description:
        "No assistente de lançamento, divida contas com amigos gerando Pix Copia e Cola ou vincule despesas ao orçamento conjunto da família.",
      contentDesktop:
        "No assistente de lançamento inteligente, ative a divisão com amigos ou direcione o lançamento diretamente para a prestação de contas familiar.",
      targetRoute:
        "/transacoes?novo=despesa&passo=3&racha=1&valor=48000&descricao=Churrasco+de+Confraternizacao",
      targetSelector: '[data-tour="wizard-split-toggle"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 4",
      actionLabel: "Ver Rachas",
    },
    {
      id: "shared-split-pending-card",
      track: "shared_finances",
      order: 2,
      title: "Rachas Ativos e Cobrança Pix",
      titleDesktop: "Divisões Pendentes e Cobrança Pix",
      description:
        "Monitore quem já pagou e abata cotas com um toque. Envie lembretes com link Pix dinâmico e mantenha os acertos em dia sem atrito.",
      contentDesktop:
        "Acompanhe o status de quitação de cada participante, envie lembretes com link Pix dinâmico e abata valores automaticamente no extrato.",
      targetRoute: "/",
      targetSelector: '[data-tour="split-pending-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 4",
      actionLabel: "Ver Modo Família",
    },
    {
      id: "shared-family-hub",
      track: "shared_finances",
      order: 3,
      title: "Teto Compartilhado e Equilíbrio da Casa",
      titleDesktop: "Teto Compartilhado e Equilíbrio Familiar",
      description:
        "Acompanhe o teto de gastos do lar, a regra de equilíbrio proporcional de renda entre os membros e liquide acertos via Pix sem expor gastos privados.",
      contentDesktop:
        "Painel integrado com teto de despesas da casa, cálculo proporcional de compensação mensal e quitação rápida sem violação de privacidade.",
      targetRoute: "/familia",
      targetSelector: '[data-tour="family-ceiling-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 4",
      actionLabel: "Ver Metas Coletivas",
    },
    {
      id: "shared-goals-thermometer",
      track: "shared_finances",
      order: 4,
      title: "Termômetro Coletivo e Vaquinha Pix",
      titleDesktop: "Metas Coletivas e Arrecadação Pix",
      description:
        "Crie vaquinhas com termômetro em tempo real, chave Pix oficial e página pública para arrecadações transparentes de viagens e eventos.",
      contentDesktop:
        "Acompanhe o termômetro de arrecadação em tempo real, compartilhe links públicos de doação e centralize o progresso financeiro das metas do grupo.",
      targetRoute: "/orcamentos?tab=goals",
      targetSelector: '[data-tour="shared-goals-card"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 4 de 4",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.0: Visão Geral Finanças & Saldo Livre (3 passos)
  finances_overview: [
    {
      id: "finances-overview-kpis",
      track: "finances_overview",
      order: 1,
      title: "Saldo Livre Real & Indicadores",
      description:
        "Monitore o saldo livre real descontando as faturas de cartões e despesas já comprometidas no mês.",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "finances-overview-transactions",
      track: "finances_overview",
      order: 2,
      title: "Lançamentos e Ritmo Financeiro",
      description:
        "Acompanhe despesas e receitas organizadas por categoria para manter o orçamento equilibrado.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="transactions-feed-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Lançamentos",
    },
    {
      id: "finances-overview-budgets",
      track: "finances_overview",
      order: 3,
      title: "Tetos e Metas Mensais",
      description:
        "Defina limites por categoria e receba alertas proativos antes de ultrapassar o valor estipulado.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.1: O Botão Wizard (+) e Lançamento Rápido (3 passos)
  finances_wizard: [
    {
      id: "wizard-bottom-btn",
      track: "finances_wizard",
      order: 1,
      title: "Acesso Rápido com o Botão Central (+)",
      titleDesktop: "Comandos Rápidos & Atalho (Ctrl+K)",
      description:
        "O botão de destaque central na barra inferior permite registrar despesas, receitas ou transferências com apenas um toque.",
      contentDesktop:
        "No desktop, utilize a barra de busca e comandos ou pressione Ctrl+K para lançar novas transações e despesas instantaneamente.",
      targetRoute: "/",
      targetSelector: '[data-tour="bottom-nav-wizard"]',
      targetSelectorDesktop: '[data-tour="desktop-new-transaction"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      spotlightBorderRadius: 9999,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "wizard-flow-selection",
      track: "finances_wizard",
      order: 2,
      title: "Lançamento de Despesa, Receita e Pix",
      description:
        "Alterne com facilidade entre Despesa, Receita e Pix. O assistente sugere categorias de forma preditiva e permite anexar comprovantes para leitura automatizada.",
      targetRoute: "/transacoes?novo=despesa",
      targetSelector: '[data-tour="launch-wizard-dialog"]',
      preferredPlacement: "top",
      spotlightPadding: 6,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Parcelas",
    },
    {
      id: "wizard-installments",
      track: "finances_wizard",
      order: 3,
      title: "Parcelamento Inteligente",
      description:
        "Divida compras no cartão ou parcelamentos fixos em até 60x com recálculo automático de competência e datas de vencimento.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-installments-section"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.2: Cartões, Faturas e Limites (3 passos)
  finances_cards: [
    {
      id: "cards-overview",
      track: "finances_cards",
      order: 1,
      title: "Fatura Aberta & Limite Disponível",
      description:
        "Visualize o total acumulado na fatura atual, limite de crédito disponível e previsão de fechamento.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "cards-best-day",
      track: "finances_cards",
      order: 2,
      title: "Melhor Dia de Compra",
      description:
        "Otimize suas compras utilizando a data de fechamento para ganhar até 40 dias sem juros.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-best-day"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Futuras",
    },
    {
      id: "cards-future-installments",
      track: "finances_cards",
      order: 3,
      title: "Comprometimento com Parcelas Futuras",
      description:
        "Acompanhe as parcelas dos próximos meses para planejar seus gastos sem surpresas na fatura.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-installments-section"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour Contas, Dívidas e Contratos (3 passos)
  finances_debts: [
    {
      id: "debts-payable-step",
      track: "finances_debts",
      order: 1,
      title: "Contas a Pagar & Urgências",
      description:
        "Monitore vencimentos críticos, contas em atraso e o saldo pendente a quitar com controle em semáforo.",
      targetRoute: "/dividas?type=payable",
      targetSelector: '[data-tour="debts-payable-section"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Ver Recebíveis",
    },
    {
      id: "debts-receivable-step",
      track: "finances_debts",
      order: 2,
      title: "Contas a Receber",
      description:
        "Acompanhe valores a receber de terceiros, previsões de entrada e dê baixa com atualização de saldo.",
      targetRoute: "/dividas?type=receivable",
      targetSelector: '[data-tour="debts-receivable-section"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Contratos",
    },
    {
      id: "debts-loans-step",
      track: "finances_debts",
      order: 3,
      title: "Contratos de Crédito & Financiamentos",
      description:
        "Cadastre contratos nos sistemas Price ou SAC, acompanhe a evolução do saldo devedor e simule amortizações extraordinárias.",
      targetRoute: "/dividas?type=loans",
      targetSelector: '[data-tour="debts-loans-section"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.3: Categorias e Tetos de Gastos (3 passos)
  finances_budgets: [
    {
      id: "budgets-overview",
      track: "finances_budgets",
      order: 1,
      title: "Planejamento por Categoria",
      description:
        "Estabeleça limites máximos mensais para moradia, alimentação, transporte, lazer e outras despesas.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "budgets-pacing-alert",
      track: "finances_budgets",
      order: 2,
      title: "Ritmo de Consumo e Alertas de Estouro",
      description:
        "Barras de progresso e indicadores visuais alertam quando o ritmo diário estiver acima do planejado.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Ajustes",
    },
    {
      id: "budgets-proportional-adjust",
      track: "finances_budgets",
      order: 3,
      title: "Ajuste Inteligente de Orçamento",
      description:
        "Realoque sobras de categorias para absorver desvios pontuais mantendo o equilíbrio mensal.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.4: Smart Advisor e Relatórios (3 passos)
  finances_insights: [
    {
      id: "insights-smart-advisor",
      track: "finances_insights",
      order: 1,
      title: "Smart Advisor & Diagnóstico Financeiro",
      description:
        "Receba insights contextuais no Dashboard com oportunidades de corte de gastos supérfluos e otimização do fluxo.",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "insights-recurring-radar",
      track: "finances_insights",
      order: 2,
      title: "Radar de Assinaturas e Recorrências",
      description:
        "Identifique cobranças recorrentes, assinaturas ativas e acompanhe o impacto na sua fatura e orçamento anual.",
      targetRoute: "/insights?aba=recurrences",
      targetSelector: '[data-tour="insights-recurrences-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Relatórios",
    },
    {
      id: "insights-monthly-report",
      track: "finances_insights",
      order: 3,
      title: "Fechamento Mensal Consolidado",
      description:
        "Gráficos de evolução histórica, fluxo líquido e comparativo com meses anteriores na tela de Relatórios.",
      targetRoute: "/relatorios",
      targetSelector: '[data-tour="reports-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.0: Visão Geral da Carteira (3 passos)
  investments_overview: [
    {
      id: "invest-overview-summary",
      track: "investments_overview",
      order: 1,
      title: "Patrimônio Consolidado",
      description:
        "Acompanhe o valor total investido, saldo em caixa e distribuição global por classe de ativos.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-summary"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "invest-overview-targets",
      track: "investments_overview",
      order: 2,
      title: "Alocação Estratégica de Ativos",
      description:
        "Compare a posição atual da sua carteira com a meta desejada para cada classe de investimento.",
      targetRoute: "/investments?tab=metas",
      targetSelector: '[data-tour="investments-targets"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Aportes",
    },
    {
      id: "invest-overview-rebalance",
      track: "investments_overview",
      order: 3,
      title: "Rebalanceamento Automático",
      description:
        "Calcule como direcionar novos aportes para recompor as metas sem necessidade de resgatar ativos.",
      targetRoute: "/investments?tab=aporte",
      targetSelector: '[data-tour="investments-rebalance"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.1: Cadastro de Ativos / Nova Operação (2 passos)
  investments_assets: [
    {
      id: "invest-assets-new-op",
      track: "investments_assets",
      order: 1,
      title: "Botão Nova Operação",
      description:
        "Cadastre novos investimentos em Renda Fixa, Ações, FIIs ou Cripto informando quantidade, preço médio e corretora.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-new-op"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Próximo",
    },
    {
      id: "invest-assets-cash",
      track: "investments_assets",
      order: 2,
      title: "Saldo em Caixa de Corretora",
      description:
        "Controle o dinheiro parado na conta da corretora pronto para ser direcionado aos próximos aportes.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-summary"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.2: Metas por Classe e Ativo (2 passos)
  investments_targets: [
    {
      id: "invest-targets-classes",
      track: "investments_targets",
      order: 1,
      title: "Metas por Classe de Ativos",
      description:
        "Defina a porcentagem ideal para Renda Fixa, Fundos Imobiliários, Ações Brasil e Ativos Internacionais.",
      targetRoute: "/investments?tab=metas&subtab=classes",
      targetSelector: '[data-tour="targets-classes-card"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Próximo",
    },
    {
      id: "invest-targets-individual",
      track: "investments_targets",
      order: 2,
      title: "Metas por Ativo Individual",
      description:
        "Ajuste o peso relativo de cada papel dentro da classe para calibrar a exposição ao risco da carteira.",
      targetRoute: "/investments?tab=metas&subtab=assets",
      targetSelector: '[data-tour="targets-assets-card"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.3: Calculadora de Aporte Inteligente (2 passos)
  investments_aporte: [
    {
      id: "invest-aporte-input",
      track: "investments_aporte",
      order: 1,
      title: "Valor do Novo Aporte",
      description:
        "Informe o valor em reais disponível para investir no mês atual ou no período desejado.",
      targetRoute: "/investments?tab=aporte",
      targetSelector: '[data-tour="investments-rebalance"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Próximo",
    },
    {
      id: "invest-aporte-recommendation",
      track: "investments_aporte",
      order: 2,
      title: "Alocação Otimizada pelo Motor",
      description:
        "O algoritmo calcula a distribuição exata entre os ativos mais distantes da meta sem vender posições.",
      targetRoute: "/investments?tab=aporte&valor=500000",
      targetSelector: '[data-tour="aporte-result-section"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Trilha 3: Configurações, Personalização & Suporte (5 passos integrados)
  settings_support: [
    {
      id: "settings-privacy-theme",
      track: "settings_support",
      order: 1,
      title: "Atalhos Rápidos de Cabeçalho",
      description:
        "Ative o Modo Privacidade para ocultar valores ao usar o app em público e alterne rapidamente entre temas claro e escuro no topo da tela.",
      targetRoute: "/",
      targetSelector: '[data-tour="header-privacy-theme"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 5",
      actionLabel: "Próximo",
    },
    {
      id: "settings-experience-presets",
      track: "settings_support",
      order: 2,
      title: "Modos de Experiência & Sensorial",
      description:
        "Escolha entre os presets Dinâmico, Foco (Minimalista) e Discreto (Silencioso) para calibrar animações, sons, vibrações táteis e densidade visual.",
      targetRoute: "/configuracoes?tab=appearance",
      targetSelector: '[data-tour="settings-experience-presets"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 5",
      actionLabel: "Próximo",
    },
    {
      id: "settings-visual-identity",
      track: "settings_support",
      order: 3,
      title: "Identidade Visual & Cores de Destaque",
      description:
        "Personalize o tema (Claro, Escuro, OLED, Automático), selecione sua cor de destaque favorita e ative a ocultação de centavos no Dashboard.",
      targetRoute: "/configuracoes?tab=appearance",
      targetSelector: '[data-tour="settings-visual-identity"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 5",
      actionLabel: "Próximo",
    },
    {
      id: "settings-notifications",
      track: "settings_support",
      order: 4,
      title: "Notificações, Lembretes & Assistente Bancário",
      description:
        "Configure lembretes diários de fechamento, alertas de vencimento de faturas e dívidas, e o assistente de captura de compras bancárias.",
      targetRoute: "/configuracoes?tab=notifications",
      targetSelector: '[data-tour="settings-notifications-card"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 4 de 5",
      actionLabel: "Próximo",
    },
    {
      id: "settings-support-channel",
      track: "settings_support",
      order: 5,
      title: "Central de Ajuda & Suporte Direto",
      description:
        "Tire dúvidas frequentes, consulte guias técnicos e acerte detalhes diretamente com a nossa equipe através do chat integrado de suporte.",
      targetRoute: "/configuracoes?tab=support",
      targetSelector: '[data-tour="settings-support-card"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 5 de 5",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.0: Racha de Despesas com Pix (6 passos didáticos integrados)
  finances_split: [
    {
      id: "split-wizard-toggle",
      track: "finances_split",
      order: 1,
      title: "Onde Fica o Racha & Divisão no Lançamento",
      description:
        "No assistente de lançamento (passo Detalhes), ative a chave 'Rachar despesa com amigos' para dividir o valor por pessoa e abater automaticamente a sua cota no orçamento.",
      targetRoute:
        "/transacoes?novo=despesa&passo=3&racha=1&valor=48000&descricao=Churrasco+de+Confraternizacao",
      targetSelector: '[data-tour="wizard-split-toggle"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 6",
      actionLabel: "Ver Cadastro Pix",
    },
    {
      id: "split-pix-credentials",
      track: "finances_split",
      order: 2,
      title: "Chave Pix Didática & Memorização Segura",
      description:
        "O racha utiliza sua chave Pix configurada (E-mail, Celular, CPF ou EVP). No tour demonstrativo, dados fictícios protegem sua privacidade enquanto você aprende.",
      targetRoute: "/transacoes?racha_preview=1",
      targetSelector: '[data-tour="split-mockup-pix-box"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 6",
      actionLabel: "Ver Link Pix",
    },
    {
      id: "split-share-actions",
      track: "finances_split",
      order: 3,
      title: "Cobrança Ilustrada & Compartilhamento",
      description:
        "O sistema gera um link dinâmico de cobrança e QR Code Pix. Amigos podem copiar o código em 1 clique ou receber a cobrança pronta no WhatsApp sem necessidade de cadastro.",
      targetRoute: "/transacoes?racha_preview=1",
      targetSelector: '[data-tour="split-mockup-card"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 6",
      actionLabel: "Ver Acesso do Amigo",
    },
    {
      id: "split-guest-access",
      track: "finances_split",
      order: 4,
      title: "Acesso pelo Link & Processo do Convidado",
      description:
        "O amigo abre o link pelo navegador do celular sem precisar instalar app ou criar conta. Ele copia o código Pix, paga no banco dele e clica em 'Já paguei via Pix'.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="active-splits-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 4 de 6",
      actionLabel: "Ver Extrato",
    },
    {
      id: "split-active-tracking",
      track: "finances_split",
      order: 5,
      title: "Rachas Ativos & Gestão de Cotas",
      description:
        "No extrato de transações, acompanhe o valor total a receber, veja quem já sinalizou pagamento e use os botões rápidos de reenvio de link ou baixa manual.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="active-splits-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 5 de 6",
      actionLabel: "Ver Sinalizações",
    },
    {
      id: "split-pending-signals",
      track: "finances_split",
      order: 6,
      title: "Aviso de Pagamento & Baixa Automática",
      description:
        "Na tela inicial, confirme o recebimento do Pix sinalizado pelos amigos com um toque em 'Dar Baixa' para liquidar o contas a receber e balancear o orçamento.",
      targetRoute: "/",
      targetSelector: '[data-tour="split-pending-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 6 de 6",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.1: Modo Família Multi-Contas (2 passos)
  finances_family: [
    {
      id: "family-ceiling-tracking",
      track: "finances_family",
      order: 1,
      title: "Teto Orçamentário da Família",
      description:
        "Defina o limite conjunto mensal da residência e monitore o ritmo consolidado de consumo para evitar surpresas no fim do mês.",
      targetRoute: "/familia",
      targetSelector: '[data-tour="family-ceiling-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Ver Equilíbrio",
    },
    {
      id: "family-balance-settlement",
      track: "finances_family",
      order: 2,
      title: "Equilíbrio de Contas e Compensação",
      description:
        "Visualize a proporção de gastos de cada participante, a divisão justa por renda e liquide as compensações com um clique via Pix.",
      targetRoute: "/familia",
      targetSelector: '[data-tour="family-balance-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.2: Metas Coletivas & Vaquinha Pix (2 passos)
  finances_goals: [
    {
      id: "goals-standalone-banner",
      track: "finances_goals",
      order: 1,
      title: "Metas Coletivas e Vaquinhas Pix",
      description:
        "Crie campanhas colaborativas para viagens, presentes e eventos com link público transparente e prestação de contas aberta.",
      targetRoute: "/orcamentos?tab=goals",
      targetSelector: '[data-tour="shared-goals-banner"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Ver Termômetro",
    },
    {
      id: "goals-thermometer-card",
      track: "finances_goals",
      order: 2,
      title: "Termômetro em Tempo Real e Apoio Pix",
      description:
        "Acompanhe o termômetro de arrecadação da campanha, compartilhe a chave Pix e visualize as contribuições recebidas.",
      targetRoute: "/orcamentos?tab=goals",
      targetSelector: '[data-tour="shared-goals-card"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.3: Modo Viagem & Rateio em Grupo (3 passos)
  finances_trips: [
    {
      id: "trips-hub",
      track: "finances_trips",
      order: 1,
      title: "Hub de Viagens & Grupos",
      description:
        "Centralize roteiros e eventos compartilhados. Cada viagem funciona como um grupo temporário seguro com link de convite.",
      targetRoute: "/viagens",
      targetSelector: '[data-tour="trips-hub"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Ver Viagem",
    },
    {
      id: "trips-balances",
      track: "finances_trips",
      order: 2,
      title: "Extrato Coletivo & Balanço Individual",
      description:
        "Veja quem pagou o quê e quanto cada participante gastou no total, com saldos positivos e negativos calculados em tempo real.",
      targetRoute: "/viagens/trip-demo-floripa",
      targetSelector: '[data-tour="trip-balances"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Liquidação",
    },
    {
      id: "trips-settlement",
      track: "finances_trips",
      order: 3,
      title: "Liquidação Mínima & Pix Copia e Cola",
      description:
        "O algoritmo inteligente calcula o menor número de transferências para zerar as pendências. Basta copiar a chave Pix e liquidar.",
      targetRoute: "/viagens/trip-demo-floripa",
      targetSelector: '[data-tour="trip-settlement-card"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Trilha 0: Recursos Nativos do APK Android (3 passos didáticos)
  app_native_apk: [
    {
      id: "native-apk-triptych",
      track: "app_native_apk",
      order: 1,
      title: "O Tripé de Plataformas: Web, PWA e Android Pro",
      description:
        "Sua conta funciona em qualquer lugar. O Web Desktop é ideal para telas grandes; o Web PWA oferece acesso leve e universal; e o APK Nativo adiciona automações exclusivas de hardware.",
      targetRoute: "/configuracoes?tab=devices",
      targetSelector: '[data-tour="settings-platforms-triptych"]',
      fallbackSelectors: ['[data-tour="settings-platform-status"]'],
      requiredTab: "security",
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Entender Recursos",
    },
    {
      id: "native-apk-updates",
      track: "app_native_apk",
      order: 2,
      title: "Instalação Segura e Atualizações Diretas",
      description:
        "O aplicativo Android Pro opera fora de lojas comerciais e conta com motor de auto-atualização integrado. Você recebe novas versões e melhorias diretamente por aqui com um único clique, sem precisar reinstalar.",
      targetRoute: "/configuracoes?tab=devices",
      targetSelector: '[data-tour="settings-platform-status"]',
      requiredTab: "security",
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Segurança",
    },
    {
      id: "native-apk-security",
      track: "app_native_apk",
      order: 3,
      title: "Biometria Física e Escudo de Privacidade",
      description:
        "Proteja seus dados patrimoniais com a impressão digital do aparelho e tempo de tolerância. O Escudo de Privacidade bloqueia capturas de tela e esconde suas finanças na lista de aplicativos recentes do Android.",
      targetRoute: "/configuracoes?tab=security",
      targetSelector: '[data-tour="settings-app-lock"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],
};

/** Retorna os passos ordenados da trilha selecionada. */
export function getTourSteps(track: TourTrackId): TourStep[] {
  return TOUR_STEPS[track] ?? [];
}
