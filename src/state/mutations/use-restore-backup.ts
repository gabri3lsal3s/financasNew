import { useMutation, useQueryClient } from "@tanstack/react-query";
import { restoreBackup } from "@/data/repositories/export";
import type { BackupPayload, RestoreSummary } from "@/domain/export";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";

export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation<RestoreSummary, Error, BackupPayload>({
    mutationFn: (payload: BackupPayload) => restoreBackup(payload),
    onSuccess: (summary) => {
      void queryClient.invalidateQueries();
      const total = Object.values(summary).reduce(
        (acc: number, curr) => acc + (typeof curr === "number" ? curr : 0),
        0,
      );
      pushToast({
        title: "Backup restaurado",
        description: `Dados restaurados com sucesso (${total} registros processados).`,
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao restaurar backup",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}
