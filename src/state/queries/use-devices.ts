import { useQuery } from "@tanstack/react-query";
import { getUserDevices } from "@/data/repositories/devices";
import type { UserDevice } from "@/types";
import { STALE_TIMES } from "@/state/cache-policy";
import { getActiveUserId } from "@/services/user-storage";

export const userDevicesKey = ["user-devices"] as const;

/**
 * Consulta a lista de dispositivos e sessões conectados do usuário autenticado.
 */
export function useDevices(options?: { enabled?: boolean }) {
  const activeUserId = getActiveUserId();
  return useQuery<UserDevice[]>({
    queryKey: userDevicesKey,
    queryFn: () => getUserDevices(),
    enabled: options?.enabled ?? Boolean(activeUserId),
    staleTime: STALE_TIMES.analytical,
  });
}
