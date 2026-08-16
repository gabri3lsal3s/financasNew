import { useQuery } from "@tanstack/react-query";
import { getOnboardingCounts } from "@/data/repositories/onboarding";

const onboardingKey = ["onboarding"] as const;

/** Contagens de dados para o onboarding de primeiro uso (§5.7). */
export function useOnboardingCounts() {
  return useQuery({
    queryKey: [...onboardingKey],
    queryFn: () => getOnboardingCounts(),
    staleTime: 60_000,
  });
}
