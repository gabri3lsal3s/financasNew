/**
 * Hooks TanStack Query e Mutações para Modo Família Colaborativo Multi-Contas (use-family.ts).
 *
 * Provê sincronização reativa de:
 *   - Membresia e unidade familiar ativa (useMyFamily);
 *   - Consolidação mensal e fatias de consumo (useFamilyConsolidation);
 *   - Resolução de convites por token (useFamilyInvite);
 *   - Histórico de liquidações auditadas (useFamilySettlements);
 *   - Mutações transacionais de criação, convite, aceitação, saída e acerto.
 *
 * Governança:
 *   - Cache unificado em STALE_TIMES.static para cadastros e STALE_TIMES.transactional para cálculos;
 *   - Feedback sensorial centralizado via triggerSensory;
 *   - Zero emojis e mensagens padronizadas em pt-BR via getErrorMessage.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyFamily,
  getFamilyConsolidation,
  createFamily,
  inviteFamilyMember,
  acceptFamilyInvite,
  leaveFamily,
  recordFamilySettlement,
  updateFamily,
  updateFamilyMember,
  revokeFamilyInvite,
  getFamilyInviteByToken,
  listFamilySettlements,
  type MyFamilyData,
  type UpdateFamilyInput,
  type UpdateFamilyMemberInput,
  type FamilyMemberWithProfile,
  type FamilyInviteWithDetails,
  type CreateFamilyParams,
  type InviteFamilyMemberParams,
  type AcceptFamilyInviteParams,
  type LeaveFamilyParams,
  type RecordFamilySettlementParams,
} from "@/data/repositories/families";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import type {
  Family,
  FamilySettlement,
  FamilyConsolidationResult,
  InviteFamilyMemberResult,
  AcceptFamilyInviteResult,
  LeaveFamilyResult,
} from "@/types";

// ---------------------------------------------------------------------------
// Query Keys Canônicas
// ---------------------------------------------------------------------------

export const familyQueryKeys = {
  all: ["family"] as const,
  myFamily: () => [...familyQueryKeys.all, "my-family"] as const,
  consolidation: (month?: string | null) =>
    [...familyQueryKeys.all, "consolidation", month ?? "current"] as const,
  settlements: (familyId?: string | null) =>
    [...familyQueryKeys.all, "settlements", familyId ?? "current"] as const,
  inviteToken: (token: string) =>
    [...familyQueryKeys.all, "invite", token] as const,
};

// ---------------------------------------------------------------------------
// Queries Reativas
// ---------------------------------------------------------------------------

/**
 * Consulta a família e membresia do usuário autenticado.
 * Cache estático de 5 minutos com invalidação automática em mutações.
 */
export function useMyFamily() {
  return useQuery<MyFamilyData | null>({
    queryKey: familyQueryKeys.myFamily(),
    queryFn: () => getMyFamily(),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}

/**
 * Consulta a consolidação familiar detalhada para a competência (mês YYYY-MM).
 * Cache transacional de 30 segundos para refletir gastos e acertos recentes.
 */
export function useFamilyConsolidation(month?: string | null) {
  return useQuery<FamilyConsolidationResult | null>({
    queryKey: familyQueryKeys.consolidation(month),
    queryFn: () => getFamilyConsolidation({ month }),
    staleTime: STALE_TIMES.transactional,
  });
}

/**
 * Resolve os detalhes de um convite a partir de seu token seguro.
 * Utilizado na tela pública de recepção e onboarding do parceiro.
 */
export function useFamilyInvite(token: string | undefined | null) {
  return useQuery<FamilyInviteWithDetails | null>({
    queryKey: familyQueryKeys.inviteToken(token ?? ""),
    queryFn: () => (token ? getFamilyInviteByToken(token) : null),
    enabled: Boolean(token && token.trim().length > 0),
    staleTime: STALE_TIMES.transactional,
  });
}

/**
 * Consulta o histórico de acertos de contas auditados da família.
 */
export function useFamilySettlements(familyId?: string | null) {
  return useQuery<FamilySettlement[]>({
    queryKey: familyQueryKeys.settlements(familyId),
    queryFn: () => (familyId ? listFamilySettlements(familyId) : Promise.resolve([])),
    enabled: Boolean(familyId),
    staleTime: STALE_TIMES.transactional,
  });
}

// ---------------------------------------------------------------------------
// Mutações de Gestão Familiar
// ---------------------------------------------------------------------------

/**
 * Criação de nova família com o criador como titular (owner).
 */
export function useCreateFamily() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateFamilyParams>({
    mutationFn: (params: CreateFamilyParams) => createFamily(params),
    onSuccess: () => {
      triggerSensory("success");
      pushToast({
        title: "Família criada com sucesso!",
        description: "Agora você pode convidar seu parceiro para planejar o orçamento juntos.",
        variant: "default",
      });
      void queryClient.invalidateQueries({ queryKey: familyQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Geração de convite seguro com token criptográfico de 7 dias.
 */
export function useInviteFamilyMember() {
  const queryClient = useQueryClient();

  return useMutation<InviteFamilyMemberResult, Error, InviteFamilyMemberParams | undefined>({
    mutationFn: (params?: InviteFamilyMemberParams) => inviteFamilyMember(params),
    onSuccess: () => {
      triggerSensory("success");
      pushToast({
        title: "Convite gerado com sucesso!",
        description: "Envie o link de convite para seu parceiro vincular a conta.",
        variant: "default",
      });
      void queryClient.invalidateQueries({ queryKey: familyQueryKeys.myFamily() });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Aceitação de convite familiar pelo parceiro autenticado.
 */
export function useAcceptFamilyInvite() {
  const queryClient = useQueryClient();

  return useMutation<AcceptFamilyInviteResult, Error, AcceptFamilyInviteParams>({
    mutationFn: (params: AcceptFamilyInviteParams) => acceptFamilyInvite(params),
    onSuccess: () => {
      triggerSensory("success");
      pushToast({
        title: "Convite aceito com sucesso!",
        description: "Você agora faz parte do Orçamento Familiar compartilhado.",
        variant: "default",
      });
      void queryClient.invalidateQueries({ queryKey: familyQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Saída da família ou dissolução da unidade (se titular único).
 */
export function useLeaveFamily() {
  const queryClient = useQueryClient();

  return useMutation<LeaveFamilyResult, Error, LeaveFamilyParams | undefined>({
    mutationFn: (params?: LeaveFamilyParams) => leaveFamily(params),
    onSuccess: (data) => {
      triggerSensory("destructive");
      pushToast({
        title: data.disbanded ? "Família encerrada." : "Você saiu da família.",
        description: "Seus dados pessoais permanecem estritamente preservados com segurança.",
        variant: "default",
      });
      void queryClient.invalidateQueries({ queryKey: familyQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["incomes"] });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Registro de acerto financeiro auditado do mês (via Pix/transferência).
 */
export function useRecordFamilySettlement() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, RecordFamilySettlementParams>({
    mutationFn: (params: RecordFamilySettlementParams) => recordFamilySettlement(params),
    onSuccess: () => {
      triggerSensory("success");
      pushToast({
        title: "Acerto de contas registrado com sucesso!",
        description: "A compensação do mês foi consolidada no histórico familiar.",
        variant: "default",
      });
      void queryClient.invalidateQueries({ queryKey: familyQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Atualização dos parâmetros cadastrais da família (nome, teto, regra).
 */
export function useUpdateFamily() {
  const queryClient = useQueryClient();

  return useMutation<Family, Error, { familyId: string; updates: UpdateFamilyInput }>({
    mutationFn: ({ familyId, updates }: { familyId: string; updates: UpdateFamilyInput }) =>
      updateFamily(familyId, updates),
    onSuccess: () => {
      triggerSensory("success");
      pushToast({
        title: "Configurações da família atualizadas com sucesso.",
        variant: "default",
      });
      void queryClient.invalidateQueries({ queryKey: familyQueryKeys.all });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Atualização de dados de perfil do participante na família (chave Pix, nome).
 */
export function useUpdateFamilyMember() {
  const queryClient = useQueryClient();

  return useMutation<FamilyMemberWithProfile, Error, { memberId: string; updates: UpdateFamilyMemberInput }>({
    mutationFn: ({ memberId, updates }: { memberId: string; updates: UpdateFamilyMemberInput }) =>
      updateFamilyMember(memberId, updates),
    onSuccess: () => {
      triggerSensory("success");
      pushToast({
        title: "Dados do participante atualizados.",
        variant: "default",
      });
      void queryClient.invalidateQueries({ queryKey: familyQueryKeys.all });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

/**
 * Revogação de convite pendente.
 */
export function useRevokeFamilyInvite() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (inviteId: string) => revokeFamilyInvite(inviteId),
    onSuccess: () => {
      triggerSensory("destructive");
      pushToast({
        title: "Convite revogado com sucesso.",
        variant: "default",
      });
      void queryClient.invalidateQueries({ queryKey: familyQueryKeys.myFamily() });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}
