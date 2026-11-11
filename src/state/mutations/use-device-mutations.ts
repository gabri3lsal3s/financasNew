import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeDevice, deleteDevice } from "@/data/repositories/devices";
import { userDevicesKey } from "@/state/queries/use-devices";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";

export function useRevokeDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceRecordId: string) => revokeDevice(deviceRecordId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userDevicesKey });
      pushToast({
        title: "Dispositivo revogado",
        description: "A sessão do aparelho foi encerrada com sucesso.",
        variant: "default",
      });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível revogar o dispositivo",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceRecordId: string) => deleteDevice(deviceRecordId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userDevicesKey });
      pushToast({
        title: "Dispositivo removido",
        description: "O registro do dispositivo foi removido com sucesso.",
        variant: "default",
      });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível remover o dispositivo",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}
