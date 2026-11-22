import type { NavigateFunction } from "react-router";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import { resolveSmartAdvisorActionRoute } from "@/features/overview/components/smart-advisor/smart-advisor-routing";

export function navigateAdvisorAlert(
  item: SmartAdvisorInsight,
  navigate: NavigateFunction,
  currentSearch?: string,
): void {
  const baseSearch =
    currentSearch ?? (typeof window !== "undefined" ? window.location.search : "");
  const route = resolveSmartAdvisorActionRoute(item, baseSearch);
  if (route) {
    navigate(route);
  }
}
