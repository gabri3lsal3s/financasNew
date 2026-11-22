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
export function AdvisorCategoryIcon({
  kind,
  sizeClass = "size-4",
  inheritColor = false,
}: {
  kind: AdvisorIconKind;
  sizeClass?: string;
  inheritColor?: boolean;
}) {
  switch (kind) {
    case "household":
      return (
        <Users
          className={`${sizeClass} ${inheritColor ? "" : "text-primary-strong"} shrink-0`.trim()}
          aria-hidden="true"
        />
      );
    case "aporte":
      return (
        <TrendingUp
          className={`${sizeClass} ${inheritColor ? "" : "text-portfolio"} shrink-0`.trim()}
          aria-hidden="true"
        />
      );
    case "critical":
      return (
        <AlertTriangle
          className={`${sizeClass} ${inheritColor ? "" : "text-critical-strong"} shrink-0`.trim()}
          aria-hidden="true"
        />
      );
    case "income":
      return (
        <ArrowDownLeft
          className={`${sizeClass} ${inheritColor ? "" : "text-positive-strong"} shrink-0`.trim()}
          aria-hidden="true"
        />
      );
    case "savings":
      return (
        <TrendingDown
          className={`${sizeClass} ${inheritColor ? "" : "text-warning-strong"} shrink-0`.trim()}
          aria-hidden="true"
        />
      );
    default:
      return (
        <HelpCircle
          className={`${sizeClass} ${inheritColor ? "" : "text-muted-foreground"} shrink-0`.trim()}
          aria-hidden="true"
        />
      );
  }
}
