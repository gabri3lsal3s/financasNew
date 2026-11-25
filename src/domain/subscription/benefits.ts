/**
 * Fonte Única da Verdade (SSOT) dos benefícios do Plano Pro e do Teste de 30 Dias.
 *
 * Módulo puro de domínio: sem dependências de UI, ícones React ou Supabase (AGENTS.md Regra 3).
 * Consumido pela Landing Page, UpgradeDialog, Checkout, Recibo de Sucesso e Comparativo.
 */

export type ProBenefitIconKey =
  | "landmark"
  | "cpu"
  | "briefcase"
  | "credit-card"
  | "calculator"
  | "users"
  | "trending-up"
  | "bar-chart"
  | "file-spreadsheet";

export interface ProBenefitItem {
  readonly id: string;
  readonly iconKey: ProBenefitIconKey;
  readonly title: string;
  readonly description: string;
  readonly checkoutLabel: string;
  readonly pricingBold: string;
  readonly pricingRest: string;
  readonly comparisonLabel: string;
}

export interface PlanComparisonRow {
  readonly feature: string;
  readonly readOnly: boolean;
  readonly pro: boolean;
}

export interface ProSuccessHighlight {
  readonly id: string;
  readonly iconKey: ProBenefitIconKey;
  readonly title: string;
  readonly description: string;
}

export const PRO_BENEFITS_CATALOG: readonly ProBenefitItem[] = [
  {
    id: "cash-and-radar",
    iconKey: "landmark",
    title: "Caixa Real & Saldo Livre Diário",
    description:
      "Saiba quanto pode gastar hoje já descontando faturas, contas do mês, reserva e alertas de vencimento.",
    checkoutLabel: "Lançamentos, cartões, ativos e histórico 100% ilimitados + Caixa Real",
    pricingBold: "Caixa Real & Saldo Livre Diário",
    pricingRest: " + Radar Preventivo de vencimentos",
    comparisonLabel: "Caixa Real, Saldo Livre para gastar hoje e Tetos de Orçamento",
  },
  {
    id: "ai-intelligence",
    iconKey: "cpu",
    title: "Micro-IA Financeira Integrada",
    description:
      "Leitura Vision de cupons e Pix, importação de faturas (PDF com senha, XLS/CSV), categorização e busca inteligente.",
    checkoutLabel: "Micro-IA Financeira: leitura Vision de cupons/Pix e importação de faturas PDF/XLS",
    pricingBold: "Micro-IA Financeira inclusa:",
    pricingRest: " leitura Vision (cupons/Pix), faturas PDF/XLS e busca natural",
    comparisonLabel: "Micro-IA Financeira: leitura Vision de cupons/Pix, faturas PDF/XLS e categorização",
  },
  {
    id: "business-mode",
    iconKey: "briefcase",
    title: "Modo Negócio (MEI & PJ)",
    description:
      "Separe finanças pessoais e da empresa com DRE gerencial, guia DAS (Tax Shield), Teto MEI e Ponto de Equilíbrio.",
    checkoutLabel: "Modo Negócio (MEI & PJ): DRE, guia DAS, Teto MEI e reembolso PF/PJ",
    pricingBold: "Modo Negócio (MEI & PJ)",
    pricingRest: " com DRE, Tax Shield (DAS), Teto MEI & Ponto de Equilíbrio",
    comparisonLabel: "Modo Negócio (MEI & PJ): DRE, guia DAS, Teto MEI e Ponto de Equilíbrio",
  },
  {
    id: "cards-and-installments",
    iconKey: "credit-card",
    title: "Multi-Cartões & Parcelas em até 60x",
    description:
      "Melhor dia de compra, fechamento automático, conciliação e projeção completa de faturas futuras.",
    checkoutLabel: "Multi-Cartões em até 60x, melhor dia de compra e conciliação de faturas",
    pricingBold: "Cartões até 60x",
    pricingRest: " + A Pagar, A Receber & Contratos Price/SAC",
    comparisonLabel: "Multi-Cartões em até 60x, melhor dia de compra e faturas futuras",
  },
  {
    id: "debts-and-contracts",
    iconKey: "calculator",
    title: "Contas a Pagar/Receber, Contratos & Dívidas",
    description:
      "Controle de recebíveis, financiamentos Price/SAC e planos de quitação Bola de Neve e Avalanche.",
    checkoutLabel: "Contas a Pagar e a Receber, Contratos (Price/SAC) e Quitação de Dívidas",
    pricingBold: "Lançamentos, cartões, ativos e histórico",
    pricingRest: " 100% ilimitados",
    comparisonLabel: "Contas a Pagar e a Receber, Contratos (Price/SAC) e Quitação de Dívidas",
  },
  {
    id: "shared-finances",
    iconKey: "users",
    title: "Modo Família, Viagens & Racha Pix",
    description:
      "Orçamento proporcional do lar, grupos de viagem, vaquinhas e racha de parcelas via link público sem cadastro.",
    checkoutLabel: "Modo Família, Viagens, Vaquinhas e Racha Pix com link público sem cadastro",
    pricingBold: "Modo Família, Viagens, Vaquinhas",
    pricingRest: " & Racha Pix sem exigir cadastro",
    comparisonLabel: "Modo Família, Viagens, Vaquinhas e Racha Pix com link público sem cadastro",
  },
  {
    id: "investments-and-valuation",
    iconKey: "trending-up",
    title: "Carteira Multi-Ativos, Preço Teto & Aportes",
    description:
      "Ações, FIIs, Renda Fixa (CDI/IPCA+) e Exterior (PTAX) com Bazin, Graham, Gordon, P/VP e rebalanceamento sem vendas.",
    checkoutLabel: "Carteira Multi-Ativos, Preço Teto (Bazin/Graham/Gordon) e Aportes sem vendas",
    pricingBold: "Carteira Multi-Ativos & Preço Teto",
    pricingRest: " (Bazin, Graham, Gordon, P/VP) e Aportes sem vender",
    comparisonLabel: "Carteira Multi-Ativos, Preço Teto (Bazin, Graham, Gordon, P/VP) e Aportes sem vendas",
  },
  {
    id: "reports-and-memory",
    iconKey: "file-spreadsheet",
    title: "7 Relatórios A4/PDF, Excel & Memória de Cálculo",
    description:
      "DRE Pessoal e PJ, Balanço 360°, Dossiê da Carteira e planilha de 5 abas (.xlsx) com todas as fórmulas abertas.",
    checkoutLabel: "7 Relatórios Executivos A4/PDF, Excel (.xlsx) e Memória de Cálculo aberta",
    pricingBold: "7 Relatórios Executivos A4/PDF, Excel (.xlsx)",
    pricingRest: " & Memória de Cálculo",
    comparisonLabel: "7 Relatórios Executivos A4/PDF, Excel (.xlsx) e Memória de Cálculo aberta",
  },
] as const;

export const PRO_TRIAL_HIGHLIGHTS: readonly string[] = [
  "Acesso 100% liberado a todos os módulos do Plano Pro por 30 dias",
  "Caixa Real, Saldo Livre para gastar hoje e Cartões em até 60x",
  "Micro-IA inclusa: leitura Vision de cupons/Pix e importação de faturas PDF/XLS",
  "Modo Negócio (MEI/PJ) com DRE, guia DAS, Teto MEI e Ponto de Equilíbrio",
  "Modo Família, Viagens, Carteira Multi-Ativos, Preço Teto e 7 Relatórios A4/Excel",
] as const;

export const PRO_CHECKOUT_BENEFITS: readonly string[] = PRO_BENEFITS_CATALOG.map(
  (item) => item.checkoutLabel,
);

export const PRO_SUCCESS_HIGHLIGHTS: readonly ProSuccessHighlight[] = [
  {
    id: "core-and-ai",
    iconKey: "cpu",
    title: "Caixa Real, Cartões até 60x & Micro-IA Vision",
    description:
      "Saldo livre para gastar hoje, importação universal de faturas (PDF/XLS) e leitura de cupons/Pix sem digitação.",
  },
  {
    id: "business-mode",
    iconKey: "briefcase",
    title: "Modo Negócio (MEI & PJ) & Separação PF/PJ",
    description:
      "DRE gerencial, reserva automática de imposto (Tax Shield/DAS), Teto MEI e Ponto de Equilíbrio.",
  },
  {
    id: "shared-finances",
    iconKey: "users",
    title: "Modo Família, Viagens & Racha Pix",
    description:
      "Teto familiar proporcional, grupos de viagem, vaquinhas e divisão de parcelas com link público sem cadastro.",
  },
  {
    id: "investments-and-reports",
    iconKey: "trending-up",
    title: "Carteira Multi-Ativos, Preço Teto & 7 Relatórios",
    description:
      "Ações, FIIs, Renda Fixa e Exterior com Valuation, aportes sem vendas, A4/PDF e Excel (.xlsx) auditável.",
  },
] as const;

export const PLAN_COMPARISON_ROWS: readonly PlanComparisonRow[] = [
  {
    feature: "Consulta de histórico, saldos, extratos e gráficos",
    readOnly: true,
    pro: true,
  },
  {
    feature: "Exportação de backup e dados brutos (.csv / .json)",
    readOnly: true,
    pro: true,
  },
  {
    feature: "Novos lançamentos, cartões, ativos e aportes ilimitados",
    readOnly: false,
    pro: true,
  },
  ...PRO_BENEFITS_CATALOG.map((item) => ({
    feature: item.comparisonLabel,
    readOnly: false,
    pro: true,
  })),
] as const;
