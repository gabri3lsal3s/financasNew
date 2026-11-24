import { useQuery } from "@tanstack/react-query";
import { getMyBillingContact } from "@/data/repositories/billing";
import { useAuth } from "@/hooks/use-auth";
import type { BillingContactInfo } from "@/types/billing";

export const BILLING_CONTACT_KEY = ["billing-contact"] as const;

/**
 * Consulta segura de dados de contato de cobrança (CPF, telefone, CEP e número)
 * para pré-preenchimento do checkout e troca de cartão via RPC `get_my_billing_contact` (D-02).
 * Usa `gcTime: 0` para não reter PII financeiro em memória após o uso do formulário.
 */
export function useBillingContact(enabled = true) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  return useQuery<BillingContactInfo | null>({
    queryKey: [...BILLING_CONTACT_KEY, userId],
    queryFn: () => getMyBillingContact(),
    enabled: Boolean(enabled && userId),
    staleTime: 60_000,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
