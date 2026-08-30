import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateInvite,
  adminRemoveFeatureOverride,
  adminRevokeInvite,
  adminSetFeatureOverride,
  adminSetUserRole,
  adminToggleGlobalFeature,
  adminUpdateUserStatus,
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
} from "../queries/use-admin";

import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import type { ModuleAccessLevel, SubscriptionTier, UserRole, UserStatus } from "@/types";

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
