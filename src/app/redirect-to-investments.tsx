import { Navigate } from "react-router";

/**
 * Unificação da carteira (2026-08-15): a antiga rota `/carteira` foi absorvida
 * pela área única de investimentos (abas Resumo/Metas/Aporte). Redireciona os
 * deep-links antigos (Home, FAB, favoritos) para o hub `/investments`.
 *
 * Isolado em arquivo próprio para manter `routes.tsx` sem componentes
 * (fast-refresh limpo — react-refresh/only-export-components).
 */
export function RedirectToInvestments() {
  return <Navigate to="/investments" replace />;
}
