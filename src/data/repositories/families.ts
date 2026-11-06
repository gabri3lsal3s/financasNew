/**
 * Repositório de Modo Família Colaborativo Multi-Contas (families.ts).
 *
 * Gerencia a agregação de unidades familiares, membresias, convites seguros,
 * acertos financeiros auditáveis e delegação a RPCs transacionais de consolidação.
 *
 * Conformidade com as Salvaguardas Blindadas de Engenharia:
 *   - F1: Isolamento Sagrado de RLS (Zero Data Bleed);
 *   - F3: Sanitização Estrita de Colunas Bancárias;
 *   - F4: Imutabilidade Cruzada por RLS;
 *   - F5: Registro e Auditoria de Acertos (family_settlements).
 */

import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { currentUserId } from "@/data/session";
import {
  getFamilyConsolidation as getFamilyConsolidationRpc,
  createFamily as createFamilyRpc,
  inviteFamilyMember as inviteFamilyMemberRpc,
  getFamilyInvitePreview as getFamilyInvitePreviewRpc,
  acceptFamilyInvite as acceptFamilyInviteRpc,
  leaveFamily as leaveFamilyRpc,
  removeFamilyMember as removeFamilyMemberRpc,
  recordFamilySettlement as recordFamilySettlementRpc,
  getFamilyIncomeRatioSuggestion as getFamilyIncomeRatioSuggestionRpc,
  getFamilyPortfolioSummary as getFamilyPortfolioSummaryRpc,
  type GetFamilyConsolidationParams,
  type CreateFamilyParams,
  type InviteFamilyMemberParams,
  type GetFamilyInvitePreviewParams,
  type AcceptFamilyInviteParams,
  type LeaveFamilyParams,
  type RecordFamilySettlementParams,
  type GetFamilyIncomeRatioSuggestionParams,
  type GetFamilyPortfolioSummaryParams,
} from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type {
  Family,
  FamilySplitRule,
  FamilyMember,
  FamilyMemberWithProfile,
  MyFamilyData,
  FamilyMemberRole,
  FamilyPixKeyType,
  FamilyInvite,
  FamilyInviteStatus,
  FamilySettlement,
  FamilySettlementPaymentMethod,
  FamilyConsolidationResult,
  InviteFamilyMemberResult,
  AcceptFamilyInviteResult,
  LeaveFamilyResult,
  RemoveFamilyMemberResult,
  FamilyIncomeRatioSuggestionItem,
  FamilyPortfolioSummary,
} from "@/types";

export type {
  GetFamilyConsolidationParams,
  CreateFamilyParams,
  InviteFamilyMemberParams,
  GetFamilyInvitePreviewParams,
  AcceptFamilyInviteParams,
  LeaveFamilyParams,
  RecordFamilySettlementParams,
  GetFamilyIncomeRatioSuggestionParams,
  GetFamilyPortfolioSummaryParams,
};

export type { FamilyMemberWithProfile, MyFamilyData };

export interface UpdateFamilyInput {
  name?: string;
  monthly_budget?: number | null;
  split_rule?: FamilySplitRule;
}

export interface UpdateFamilyMemberInput {
  display_name?: string | null;
  pix_key?: string | null;
  pix_key_type?: FamilyPixKeyType | null;
  split_ratio?: number | null;
  share_all_portfolio?: boolean;
  shared_asset_classes?: string[] | null;
}

export interface FamilyInviteWithDetails extends FamilyInvite {
  family_name?: string | null;
  family_owner_id?: string | null;
  inviter_name?: string | null;
}

// ---------------------------------------------------------------------------
// Mappers Canônicos
// ---------------------------------------------------------------------------

function mapFamily(row: Record<string, unknown>): Family {
  return {
    id: String(row.id),
    name: String(row.name),
    owner_id: String(row.owner_id),
    monthly_budget: row.monthly_budget != null ? Math.round(Number(row.monthly_budget) * 100) : null,
    split_rule: (row.split_rule as FamilySplitRule) ?? "equal",
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapFamilyMember(row: Record<string, unknown>): FamilyMemberWithProfile {
  return {
    id: String(row.id),
    family_id: String(row.family_id),
    user_id: String(row.user_id),
    role: (row.role as FamilyMemberRole) ?? "member",
    display_name: row.display_name ? String(row.display_name) : null,
    pix_key: row.pix_key ? String(row.pix_key) : null,
    pix_key_type: (row.pix_key_type as FamilyPixKeyType) ?? null,
    split_ratio: row.split_ratio != null ? Number(row.split_ratio) : null,
    share_all_portfolio: Boolean(row.share_all_portfolio),
    shared_asset_classes: Array.isArray(row.shared_asset_classes)
      ? (row.shared_asset_classes as string[])
      : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapFamilyInvite(row: Record<string, unknown>): FamilyInvite {
  return {
    id: String(row.id),
    family_id: String(row.family_id),
    invited_by: String(row.invited_by),
    invited_email: row.invited_email ? String(row.invited_email) : null,
    token: String(row.token),
    status: (row.status as FamilyInviteStatus) ?? "pending",
    role: (row.role as FamilyMemberRole) ?? "member",
    created_at: String(row.created_at),
    expires_at: String(row.expires_at),
    accepted_by: row.accepted_by ? String(row.accepted_by) : null,
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
  };
}

function mapFamilySettlement(row: Record<string, unknown>): FamilySettlement {
  return {
    id: String(row.id),
    family_id: String(row.family_id),
    month: String(row.month),
    payer_id: String(row.payer_id),
    receiver_id: String(row.receiver_id),
    amount: Number(row.amount),
    settled_at: String(row.settled_at),
    payment_method: (row.payment_method as FamilySettlementPaymentMethod) ?? "pix",
    notes: row.notes ? String(row.notes) : null,
    snapshot: (row.snapshot as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    created_by: String(row.created_by),
  };
}

// ---------------------------------------------------------------------------
// Consultas do Repositório
// ---------------------------------------------------------------------------

/**
 * Recupera os dados da família do usuário autenticado.
 * Retorna null de forma fail-safe caso o usuário não pertença a nenhuma família.
 */
export async function getMyFamily(): Promise<MyFamilyData | null> {
  let userId: string;
  try {
    userId = await currentUserId();
  } catch {
    return null;
  }
  if (!userId) return null;

  // 1. Localizar associação de membresia do usuário logado
  const { data: memberData, error: memberError } = await resolveQuery<Record<string, unknown> | null>(
    getSupabase()
      .from("family_members")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  );

  if (memberError) {
    const classified = classifyError(memberError);
    throw new AppError(classified.kind, classified.message, memberError);
  }

  if (!memberData) {
    return null;
  }

  const currentMember = mapFamilyMember(memberData);
  const familyId = currentMember.family_id;

  // 2. Buscar metadados da família
  const { data: familyData, error: familyError } = await resolveQuery<Record<string, unknown> | null>(
    getSupabase()
      .from("families")
      .select("*")
      .eq("id", familyId)
      .maybeSingle(),
  );

  if (familyError) {
    const classified = classifyError(familyError);
    throw new AppError(classified.kind, classified.message, familyError);
  }

  if (!familyData) {
    return null;
  }

  const family = mapFamily(familyData);

  // 3. Buscar todos os membros da família
  const { data: allMembersData, error: allMembersError } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("family_members")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true }),
  );

  if (allMembersError) {
    const classified = classifyError(allMembersError);
    throw new AppError(classified.kind, classified.message, allMembersError);
  }

  const members = (allMembersData ?? []).map(mapFamilyMember);

  // 4. Se for admin ou owner, buscar convites pendentes e recentes da família
  let invites: FamilyInvite[] = [];
  if (currentMember.role === "owner" || currentMember.role === "admin") {
    const { data: invitesData, error: invitesError } = await resolveQuery<Record<string, unknown>[]>(
      getSupabase()
        .from("family_invites")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false }),
    );

    if (invitesError) {
      const classified = classifyError(invitesError);
      throw new AppError(classified.kind, classified.message, invitesError);
    }

    invites = (invitesData ?? []).map(mapFamilyInvite);
  }

  return {
    family,
    members,
    currentMember,
    invites,
  };
}

/**
 * Consulta a consolidação financeira familiar para uma competência (mês).
 * Delega para a RPC blindada get_family_consolidation.
 */
export async function getFamilyConsolidation(
  params?: GetFamilyConsolidationParams,
): Promise<FamilyConsolidationResult | null> {
  return getFamilyConsolidationRpc(params);
}

/**
 * Cria atomicamente uma nova unidade familiar, tornando o criador proprietário (owner).
 * Delega para a RPC transacional create_family.
 * Converte o teto mensal de centavos (domínio) para reais (Postgres).
 */
export async function createFamily(params: CreateFamilyParams): Promise<string> {
  const payload: CreateFamilyParams = {
    ...params,
    monthlyBudget: params.monthlyBudget != null ? params.monthlyBudget / 100 : null,
  };
  return createFamilyRpc(payload);
}

/**
 * Gera um convite seguro com token criptográfico de 7 dias.
 * Delega para a RPC transacional invite_family_member.
 * Gera token seguro no client via Web Crypto API para máxima resiliência.
 */
export async function inviteFamilyMember(
  params?: InviteFamilyMemberParams,
): Promise<InviteFamilyMemberResult> {
  const generatedToken =
    params?.token ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).substring(2) + Date.now().toString(36));

  return inviteFamilyMemberRpc({
    ...params,
    token: generatedToken,
  });
}

/**
 * Vincula atomicamente o parceiro autenticado à família via token de convite.
 * Delega para a RPC transacional accept_family_invite.
 */
export async function acceptFamilyInvite(
  params: AcceptFamilyInviteParams,
): Promise<AcceptFamilyInviteResult> {
  return acceptFamilyInviteRpc(params);
}

/**
 * Desvincula o usuário da família ou dissolve a unidade (se proprietário).
 * Delega para a RPC transacional leave_family com garantia de Zero Data Bleed.
 */
export async function leaveFamily(params?: LeaveFamilyParams): Promise<LeaveFamilyResult> {
  return leaveFamilyRpc(params);
}

/**
 * Dissolve completamente a unidade familiar (ação exclusiva do titular/owner).
 * Exclui a família e desassocia lançamentos individuais com Zero Data Bleed.
 */
export async function deleteFamily(familyId?: string): Promise<LeaveFamilyResult> {
  return leaveFamilyRpc({ familyId, disband: true });
}

/**
 * Remove um membro da unidade familiar (ação exclusiva do titular/owner).
 * Desvincula os dados do participante com garantia de Zero Data Bleed.
 */
export async function removeFamilyMember(
  familyId: string,
  targetUserId: string,
): Promise<RemoveFamilyMemberResult> {
  return removeFamilyMemberRpc({ familyId, targetUserId });
}

/**
 * Registra o acerto financeiro auditável do mês entre os parceiros.
 * Delega para a RPC transacional record_family_settlement.
 */
export async function recordFamilySettlement(
  params: RecordFamilySettlementParams,
): Promise<string> {
  return recordFamilySettlementRpc(params);
}

/**
 * Atualiza os metadados cadastrais da família (nome, teto, regra de rateio).
 * Converte o teto de centavos (domínio) para reais (Postgres).
 */
export async function updateFamily(
  familyId: string,
  updates: UpdateFamilyInput,
): Promise<Family> {
  const payload: Partial<Family> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.monthly_budget !== undefined) {
    payload.monthly_budget = updates.monthly_budget != null ? updates.monthly_budget / 100 : null;
  }
  if (updates.split_rule !== undefined) payload.split_rule = updates.split_rule;

  const { data, error } = await resolveQuery<Record<string, unknown>>(
    getSupabase()
      .from("families")
      .update(payload)
      .eq("id", familyId)
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  if (!data) {
    throw new AppError("validation", "Família não encontrada para atualização.");
  }

  return mapFamily(data);
}

/**
 * Atualiza os dados de perfil do participante na família (nome de exibição, chave Pix, ratio).
 */
export async function updateFamilyMember(
  memberId: string,
  updates: UpdateFamilyMemberInput,
): Promise<FamilyMemberWithProfile> {
  const payload: Partial<FamilyMember> = {};
  if (updates.display_name !== undefined) {
    payload.display_name = updates.display_name ? updates.display_name.trim() : null;
  }
  if (updates.pix_key !== undefined) {
    payload.pix_key = updates.pix_key ? updates.pix_key.trim() : null;
  }
  if (updates.pix_key_type !== undefined) {
    payload.pix_key_type = updates.pix_key_type;
  }
  if (updates.split_ratio !== undefined) {
    payload.split_ratio = updates.split_ratio;
  }
  if (updates.share_all_portfolio !== undefined) {
    payload.share_all_portfolio = updates.share_all_portfolio;
  }
  if (updates.shared_asset_classes !== undefined) {
    payload.shared_asset_classes = updates.shared_asset_classes;
  }

  const { data, error } = await resolveQuery<Record<string, unknown>>(
    getSupabase()
      .from("family_members")
      .update(payload)
      .eq("id", memberId)
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  if (!data) {
    throw new AppError("validation", "Membro familiar não encontrado para atualização.");
  }

  return mapFamilyMember(data);
}

/**
 * Revoga um convite pendente.
 */
export async function revokeFamilyInvite(inviteId: string): Promise<void> {
  const { error } = await resolveQuery(
    getSupabase()
      .from("family_invites")
      .update({ status: "revoked" })
      .eq("id", inviteId),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Busca os dados de um convite a partir de seu token criptográfico.
 * Utilizado na tela pública de recepção e onboarding do parceiro (/convite-familiar/:token).
 */
export async function getFamilyInviteByToken(
  token: string,
): Promise<FamilyInviteWithDetails | null> {
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  // 1. Tentar via RPC segura pública get_family_invite_preview
  try {
    const preview = await getFamilyInvitePreviewRpc({ token: cleanToken });
    if (preview) {
      return {
        id: String(preview.id),
        family_id: String(preview.family_id),
        invited_by: String(preview.invited_by),
        invited_email: preview.invited_email ? String(preview.invited_email) : null,
        token: String(preview.token),
        status: (preview.status as FamilyInviteStatus) ?? "pending",
        role: (preview.role as FamilyMemberRole) ?? "member",
        created_at: String(preview.created_at),
        expires_at: String(preview.expires_at),
        accepted_by: preview.accepted_by ? String(preview.accepted_by) : null,
        accepted_at: preview.accepted_at ? String(preview.accepted_at) : null,
        family_name: preview.family_name ? String(preview.family_name) : null,
        family_owner_id: null,
        inviter_name: preview.inviter_name ? String(preview.inviter_name) : null,
      };
    }
  } catch {
    // Fallback gracioso para a consulta direta no banco
  }

  // 2. Consulta direta de fallback para compatibilidade e testes locais
  const { data: inviteData, error: inviteError } = await resolveQuery<Record<string, unknown> | null>(
    getSupabase()
      .from("family_invites")
      .select("*")
      .eq("token", cleanToken)
      .maybeSingle(),
  );

  if (inviteError) {
    const classified = classifyError(inviteError);
    throw new AppError(classified.kind, classified.message, inviteError);
  }

  if (!inviteData) return null;

  const invite = mapFamilyInvite(inviteData);

  // Buscar metadados básicos da família convidante
  const { data: familyData } = await resolveQuery<Record<string, unknown> | null>(
    getSupabase()
      .from("families")
      .select("id, name, owner_id")
      .eq("id", invite.family_id)
      .maybeSingle(),
  );

  // Buscar nome do convidador no perfil
  const { data: inviterProfile } = await resolveQuery<Record<string, unknown> | null>(
    getSupabase()
      .from("profiles")
      .select("name")
      .eq("id", invite.invited_by)
      .maybeSingle(),
  );

  return {
    ...invite,
    family_name: familyData?.name ? String(familyData.name) : null,
    family_owner_id: familyData?.owner_id ? String(familyData.owner_id) : null,
    inviter_name: inviterProfile?.name ? String(inviterProfile.name) : null,
  };
}

/**
 * Lista o histórico recente de acertos financeiros auditados da família.
 */
export async function listFamilySettlements(
  familyId: string,
  limit = 12,
): Promise<FamilySettlement[]> {
  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("family_settlements")
      .select("*")
      .eq("family_id", familyId)
      .order("settled_at", { ascending: false })
      .limit(limit),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return (data ?? []).map(mapFamilySettlement);
}

/**
 * Consulta a sugestão inteligente de rateio baseada na média de receitas dos membros nos últimos meses.
 */
export async function getFamilyIncomeRatioSuggestion(
  params?: GetFamilyIncomeRatioSuggestionParams,
): Promise<FamilyIncomeRatioSuggestionItem[]> {
  return getFamilyIncomeRatioSuggestionRpc(params);
}

/**
 * Consulta o resumo do patrimônio e reserva de emergência compartilhados com a família.
 */
export async function getFamilyPortfolioSummary(
  params?: GetFamilyPortfolioSummaryParams,
): Promise<FamilyPortfolioSummary | null> {
  return getFamilyPortfolioSummaryRpc(params);
}

/**
 * Alterna a marcação familiar de um ativo individual da carteira do usuário.
 */
export async function togglePortfolioAssetFamily(
  assetId: string,
  isFamily: boolean,
  familyId?: string | null,
): Promise<void> {
  const { error } = await resolveQuery(
    getSupabase()
      .from("portfolio_assets")
      .update({
        is_family: isFamily,
        family_id: isFamily ? (familyId ?? null) : null,
      })
      .eq("id", assetId),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
