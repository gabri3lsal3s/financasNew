import { useQuery } from "@tanstack/react-query";
import { listInvoices } from "@/data/repositories/billing";
import { STALE_TIMES } from "@/state/cache-policy";
import { useUserAccess } from "./use-user-access";
import type { BillingInvoiceItem } from "@/types/billing";

export const INVOICES_KEY = ["billing_invoices"] as const;

export function useInvoices(enabled = true) {
  const { profile } = useUserAccess();

  return useQuery<BillingInvoiceItem[]>({
    queryKey: [...INVOICES_KEY, profile?.id],
    queryFn: () => listInvoices(),
    enabled: Boolean(profile?.id) && enabled,
    staleTime: STALE_TIMES.static,
  });
}
