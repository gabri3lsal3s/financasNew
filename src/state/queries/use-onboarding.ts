import { useQuery } from "@tanstack/react-query";
import { getOnboardingCounts } from "@/data/repositories/onboarding";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedOnboardingCounts } from "./use-simulated-queries";

const onboardingKey = ["onboarding"] as const;

/** Contagens de dados para o onboarding de primeiro uso (§5.7). */
export function useOnboardingCounts() {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedOnboardingCounts();
  const real = useQuery({
    queryKey: [...onboardingKey],
    queryFn: () => getOnboardingCounts(),
    enabled: !isDemoActive,
    staleTime: 60_000,
  });

  return isDemoActive ? simulated : real;
}
