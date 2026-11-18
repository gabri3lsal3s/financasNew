import {
  AlertTriangle,
  ArrowDownLeft,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { AdvisorIconKind } from "./smart-advisor-routing";

/**
 * Ícone semântico da categoria de recomendação exibido no cabeçalho do SmartAdvisor.
 */
export function AdvisorCategoryIcon({ kind }: { kind: AdvisorIconKind }) {
  switch (kind) {
    case "household":
      return <Users className="size-4 text-primary-strong shrink-0" aria-hidden="true" />;
    case "aporte":
      return <TrendingUp className="size-4 text-portfolio shrink-0" aria-hidden="true" />;
    case "critical":
      return <AlertTriangle className="size-4 text-critical-strong shrink-0" aria-hidden="true" />;
    case "income":
      return <ArrowDownLeft className="size-4 text-positive-strong shrink-0" aria-hidden="true" />;
    case "savings":
      return <TrendingDown className="size-4 text-warning-strong shrink-0" aria-hidden="true" />;
    default:
      return <HelpCircle className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />;
  }
}
