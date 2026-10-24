import type { TourTrackId } from "./types";

/**
 * Determina o destino de navegação e hand-off contextual quando o usuário
 * encerra a simulação para iniciar a sua conta real.
 *
 * Regras:
 * - Se em Cartões (/cartoes): direciona para "/cartoes?novo=cartao" abrindo o cadastro do 1º cartão.
 * - Se em Investimentos (/investments ou /investimentos) ou trilha "investments": direciona para "/investments?novo=investimento".
 * - Se em Transações (/transacoes): direciona para "/transacoes?novo=despesa".
 * - Se em Orçamentos (/orcamentos): direciona para "/orcamentos".
 * - Padrão (Finanças / Dashboard /): direciona para "/?novo=despesa", abrindo o modal de Nova Despesa
 *   sobre o Dashboard com o Checklist de Primeiro Uso pronto para preenchimento.
 */
export function getTourHandoffDestination(
  track: TourTrackId | null,
  currentPath?: string,
): string {
  const normalizedPath = (currentPath ?? "/").toLowerCase().trim();

  if (normalizedPath.includes("/cartoes") || normalizedPath.includes("/cards")) {
    return "/cartoes?novo=cartao";
  }

  if (
    normalizedPath.includes("/invest") ||
    normalizedPath.includes("/carteira") ||
    track === "investments"
  ) {
    return "/investments?novo=investimento";
  }

  if (normalizedPath.includes("/transacoes") || normalizedPath.includes("/transactions")) {
    return "/transacoes?novo=despesa";
  }

  if (normalizedPath.includes("/orcamentos") || normalizedPath.includes("/budgets")) {
    return "/orcamentos";
  }

  return "/?novo=despesa";
}
