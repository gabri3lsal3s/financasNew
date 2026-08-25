import { useQuery } from "@tanstack/react-query";
import { fetchAllUserData } from "@/data/repositories/export";
import type { BackupPayload } from "@/domain/export";

export const EXPORT_DATA_QUERY_KEY = ["user-export-data"] as const;

export function useExportData(options?: { enabled?: boolean }) {
  return useQuery<BackupPayload>({
    queryKey: EXPORT_DATA_QUERY_KEY,
    queryFn: fetchAllUserData,
    enabled: options?.enabled ?? true,
    staleTime: 0,
  });
}
