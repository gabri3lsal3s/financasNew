import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateInvite,
  adminDeleteUser,
  adminRemoveFeatureOverride,
  adminRevokeInvite,
  adminSetFeatureOverride,
  adminSetUserRole,
  adminToggleGlobalFeature,
  adminUpdateUserStatus,
  adminSendBroadcastNotification,
  adminLogSystemBackup,
  markBroadcastAsRead,
} from "@/data/repositories/admin";
import {
  adminCreateModularInvite,
  adminRemoveUserModulePermission,
  adminSetUserModulePermission,
  adminSetUserSubscription,
} from "@/data/repositories/subscriptions";
import {
  ADMIN_AUDIT_KEY,
  ADMIN_FEATURES_KEY,
  ADMIN_INVITES_KEY,
  ADMIN_METRICS_KEY,
  ADMIN_USERS_KEY,
  ADMIN_USER_MODULE_PERMISSIONS_KEY,
  ADMIN_USER_OVERRIDES_KEY,
  ADMIN_USER_SUBSCRIPTION_KEY,
  ADMIN_BACKUPS_KEY,
  ADMIN_BROADCASTS_KEY,
  MY_BROADCASTS_KEY,
} from "../queries/use-admin";
import { userAccessQueryKey, userFeaturesQueryKey } from "../queries/use-user-access";

import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import type {
  BroadcastAudience,
  BroadcastType,
  ModuleAccessLevel,
  SubscriptionTier,
  UserRole,
  UserStatus,
} from "@/types";

export function useAdminUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { userId: string; status: UserStatus; reason?: string | null }) =>
      adminUpdateUserStatus(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Status atualizado",
        description: "O status do usuário foi alterado com sucesso.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar status",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminSetUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { userId: string; role: UserRole }) =>
      adminSetUserRole(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Permissão atualizada",
        description: "O papel do usuário foi alterado com sucesso.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao alterar papel",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminSetFeatureOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { userId: string; featureKey: string; enabled: boolean }) =>
      adminSetFeatureOverride(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_USER_OVERRIDES_KEY });
      pushToast({
        title: "Override de funcionalidade salvo",
        description: "A configuração personalizada foi aplicada ao usuário.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao salvar override",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminRemoveFeatureOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { userId: string; featureKey: string }) =>
      adminRemoveFeatureOverride(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_USER_OVERRIDES_KEY });
      pushToast({
        title: "Override removido",
        description: "O usuário voltou a seguir a regra global padrão da funcionalidade.",
        variant: "success",
      });
    },

    onError: (err) => {
      pushToast({
        title: "Erro ao remover override",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminToggleGlobalFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { featureKey: string; enabled: boolean }) =>
      adminToggleGlobalFeature(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_FEATURES_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Funcionalidade global atualizada",
        description: "O Kill-Switch da funcionalidade foi atualizado com sucesso.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar funcionalidade global",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminCreateInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      code: string;
      maxUses?: number;
      expiresAt?: string | null;
      targetEmail?: string | null;
    }) => adminCreateInvite(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Convite gerado",
        description: "O código de convite foi cadastrado na allowlist.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao criar convite",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminRevokeInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { inviteId: string }) => adminRevokeInvite(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Convite revogado",
        description: "O convite foi invalidado e não aceitará novos cadastros.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao revogar convite",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminSetUserSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      userId: string;
      planId: string;
      tier: SubscriptionTier;
      status: string;
      trialEndsAt?: string | null;
      currentPeriodEnd?: string | null;
    }) => adminSetUserSubscription(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...ADMIN_USER_SUBSCRIPTION_KEY, variables.userId] });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_KEY });
      pushToast({
        title: "Plano atualizado",
        description: "A assinatura do usuário foi atualizada com sucesso.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar plano",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminSetUserModulePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      userId: string;
      moduleKey: string;
      accessLevel: ModuleAccessLevel;
      expiresAt?: string | null;
    }) => adminSetUserModulePermission(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...ADMIN_USER_MODULE_PERMISSIONS_KEY, variables.userId] });
      void queryClient.invalidateQueries({ queryKey: userAccessQueryKey(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: userFeaturesQueryKey(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Permissão de módulo salva",
        description: "A permissão modular do usuário foi atualizada.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao salvar permissão",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminRemoveUserModulePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      userId: string;
      moduleKey: string;
    }) => adminRemoveUserModulePermission(params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...ADMIN_USER_MODULE_PERMISSIONS_KEY, variables.userId] });
      void queryClient.invalidateQueries({ queryKey: userAccessQueryKey(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: userFeaturesQueryKey(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Permissão restaurada",
        description: "O módulo voltou a seguir o plano base do usuário.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao restaurar permissão",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminCreateModularInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      code: string;
      targetTier?: SubscriptionTier;
      customTrialDays?: number | null;
      moduleGrants?: Record<string, ModuleAccessLevel>;
      maxUses?: number;
      expiresAt?: string | null;
      targetEmail?: string | null;
      notes?: string | null;
    }) => adminCreateModularInvite(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Convite modular gerado",
        description: "O código de convite com regras customizadas foi criado na allowlist.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao criar convite modular",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { targetUserId: string }) => adminDeleteUser(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Usuário excluído",
        description: "O usuário e todos os seus dados foram definitivamente removidos do sistema.",
        variant: "default",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir usuário",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminSendBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      title: string;
      message: string;
      type?: BroadcastType;
      actionUrl?: string | null;
      targetAudience?: BroadcastAudience;
      targetUserIds?: string[] | null;
    }) => adminSendBroadcastNotification(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_BROADCASTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Notificação enviada",
        description: "O comunicado foi disparado com sucesso aos destinatários selecionados.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao enviar notificação",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useAdminLogBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      backupType?: "manual" | "scheduled" | "pre_migration";
      tableCount?: number;
      recordCount?: number;
      fileSizeBytes?: number;
      checksumSha256?: string;
      status?: "in_progress" | "completed" | "failed";
      notes?: string | null;
    }) => adminLogSystemBackup(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_BACKUPS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_AUDIT_KEY });
      pushToast({
        title: "Backup registrado",
        description: "O snapshot do sistema foi registrado no histórico com sucesso.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao registrar backup",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

export function useMarkBroadcastAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markBroadcastAsRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_BROADCASTS_KEY });
    },
  });
}

