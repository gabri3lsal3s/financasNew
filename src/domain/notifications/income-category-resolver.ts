/**
 * Motor Semântico de Categorização de Rendas & Depósitos (§Plano 09 — Tarefa 9.3).
 *
 * Responsável por inferir e selecionar exclusivamente categorias de receita (income)
 * para transações com nature: "income", eliminando o erro de classificação em despesas
 * (ex.: nunca classificar um auto-depósito Pix como Supermercado).
 *
 * Função 100% pura: sem efeitos colaterais.
 */

export interface IncomeCategoryMatch {
  categorySlug: string;
  categoryName: string;
  isAutoDeposit: boolean;
  isSalary: boolean;
  isInvestmentYield: boolean;
  isRefund: boolean;
}

/**
 * Normaliza texto para busca semântica em minúsculas e sem acentos.
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Resolve a categoria canônica de receita para uma transação de entrada de recursos.
 */
export function resolveIncomeCategory(text: string, title = ""): IncomeCategoryMatch {
  const normText = normalizeText(text);
  const normTitle = normalizeText(title);
  const combined = `${normTitle} ${normText}`.trim();

  // 1. Estorno / Reembolso / Devolução
  const isRefund =
    combined.includes("estorno") ||
    combined.includes("reembolso") ||
    combined.includes("devolucao pix") ||
    combined.includes("pix devolvido");

  if (isRefund) {
    return {
      categorySlug: "outros",
      categoryName: "Estorno / Reembolso",
      isAutoDeposit: false,
      isSalary: false,
      isInvestmentYield: false,
      isRefund: true,
    };
  }

  // 2. Salário / Folha de Pagamento
  const isSalary =
    combined.includes("salario") ||
    combined.includes("folha de pagamento") ||
    combined.includes("pagamento de salario") ||
    combined.includes("holerite");

  if (isSalary) {
    return {
      categorySlug: "salario",
      categoryName: "Salário",
      isAutoDeposit: false,
      isSalary: true,
      isInvestmentYield: false,
      isRefund: false,
    };
  }

  // 3. Proventos, Dividendos, JCP e Rendimentos Financeiros
  const isYield =
    combined.includes("proventos") ||
    combined.includes("dividendos") ||
    combined.includes("jcp") ||
    combined.includes("rendimento de saldo") ||
    combined.includes("esta rendendo") ||
    combined.includes("rendeu na conta");

  if (isYield) {
    return {
      categorySlug: "rendimentos",
      categoryName: "Rendimentos / Dividendos",
      isAutoDeposit: false,
      isSalary: false,
      isInvestmentYield: true,
      isRefund: false,
    };
  }

  // 4. Auto-Depósito / Mesma Titularidade / Aportes em Conta
  const isAutoDeposit =
    combined.includes("voce depositou") ||
    combined.includes("depositou") ||
    combined.includes("deposito via pix") ||
    combined.includes("seu dinheiro ja esta disponivel") ||
    combined.includes("ja esta disponivel") ||
    combined.includes("dinheiro disponivel") ||
    combined.includes("adicionou dinheiro") ||
    combined.includes("dinheiro na conta") ||
    combined.includes("saldo adicionado");

  if (isAutoDeposit) {
    return {
      categorySlug: "transferencias_recebidas",
      categoryName: "Transferências Recebidas",
      isAutoDeposit: true,
      isSalary: false,
      isInvestmentYield: false,
      isRefund: false,
    };
  }

  // 5. Transferência Recebida / Pix Recebido Geral
  return {
    categorySlug: "transferencias_recebidas",
    categoryName: "Transferências Recebidas",
    isAutoDeposit: false,
    isSalary: false,
    isInvestmentYield: false,
    isRefund: false,
  };
}
