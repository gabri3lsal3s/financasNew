import { useLocation } from "react-router";
import {
  BudgetsSkeleton,
  CardsSkeleton,
  DebtsSkeleton,
  OverviewSkeleton,
  TransactionsSkeleton,
} from "./finance-skeletons";
import {
  InsightsSkeleton,
  InvestmentsSkeleton,
  ReportsSkeleton,
} from "./portfolio-skeletons";
import {
  FamilySkeleton,
  RemindersSkeleton,
  SettingsSkeleton,
  TripsSkeleton,
} from "./social-settings-skeletons";

/**
 * Fallback estrutural universal para rotas sob o PageShell.
 * Mapeia todas as rotas reais do roteador para manter CLS < 0.05.
 */
export function RouteSkeletonFallback({ pathname }: { pathname?: string }) {
  const location = useLocation();
  const path = pathname ?? location.pathname;

  const renderContent = () => {
    if (
      path.startsWith("/investments") ||
      path.startsWith("/investimentos") ||
      path.startsWith("/carteira")
    ) {
      return <InvestmentsSkeleton />;
    }
    if (path.startsWith("/transacoes")) {
      return <TransactionsSkeleton />;
    }
    if (path.startsWith("/cartoes")) {
      return <CardsSkeleton />;
    }
    if (path.startsWith("/dividas")) {
      return <DebtsSkeleton />;
    }
    if (
      path.startsWith("/orcamentos") ||
      path.startsWith("/categorias") ||
      path.startsWith("/metas")
    ) {
      return <BudgetsSkeleton />;
    }
    if (path.startsWith("/viagens")) {
      return <TripsSkeleton />;
    }
    if (path.startsWith("/familia") || path.startsWith("/modo-familia")) {
      return <FamilySkeleton />;
    }
    if (path.startsWith("/insights")) {
      return <InsightsSkeleton />;
    }
    if (path.startsWith("/lembretes")) {
      return <RemindersSkeleton />;
    }
    if (path.startsWith("/relatorios")) {
      return <ReportsSkeleton />;
    }
    if (path.startsWith("/configuracoes")) {
      return <SettingsSkeleton />;
    }
    return <OverviewSkeleton />;
  };

  return (
    <div role="status" aria-busy="true" aria-live="polite" className="w-full">
      {renderContent()}
      <span className="sr-only">Carregando conteúdo da página…</span>
    </div>
  );
}
