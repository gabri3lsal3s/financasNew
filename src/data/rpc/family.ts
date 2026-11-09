import { callRpc, unwrapRpc } from "./client";
import type {
  SharedFamilyBudgetResult,
  SharedGoalTrackerResult,
  FamilyConsolidationResult,
  AcceptFamilyInviteResult,
  FamilyPixKeyType,
  FamilySettlementPaymentMethod,
  FamilySplitRule,
  InviteFamilyMemberResult,
  LeaveFamilyResult,
  RemoveFamilyMemberResult,
  FamilyIncomeRatioSuggestionItem,
  FamilyPortfolioSummary,
} from "@/types";

/**
 * Consulta pública e segura do Orçamento Familiar compartilhado (/orcamento-familiar/:token).
 */
export async function getSharedFamilyBudget(params: {
  token: string;
  month?: string | null;
}): Promise<SharedFamilyBudgetResult | null> {
  return unwrapRpc(
    callRpc("get_shared_family_budget", {
      p_token: params.token,
      p_month: params.month ?? null,
    }),
    true,
  );
}

/**
 * Consulta pública e segura do Termômetro de Meta Coletiva compartilhado (/meta/:token).
 */
export async function getSharedGoalTracker(params: {
  token: string;
}): Promise<SharedGoalTrackerResult | null> {
  return unwrapRpc(
    callRpc("get_shared_goal_tracker", {
      p_token: params.token,
    }),
    true,
  );
}

/**
 * Sinalização pública e segura de que um convidado pagou via Pix ou salvou a despesa (/r/:token).
 */
export async function signalSplitPayment(params: {
  token: string;
  participantName: string;
  amountCents: number;
  participantId?: string | null;
  installmentId?: string | null;
}): Promise<{
  success: boolean;
  signal_id: string;
  participant_matched: boolean;
  installment_matched?: boolean;
  deduplicated?: boolean;
}> {
  return unwrapRpc(
    callRpc("signal_split_payment", {
      p_token: params.token,
      p_participant_name: params.participantName,
      p_amount_cents: params.amountCents,
      p_participant_id: params.participantId ?? null,
      p_installment_id: params.installmentId ?? null,
    }),
  );
}

/**
 * Descarta uma sinalização de pagamento pelo anfitrião caso não tenha sido confirmada.
 */
export async function dismissSplitPaymentSignal(params: {
  shareId: string;
  signalId: string;
}): Promise<{ success: boolean }> {
  return unwrapRpc(
    callRpc("dismiss_split_payment_signal", {
      p_share_id: params.shareId,
      p_signal_id: params.signalId,
    }),
  );
}

export interface GetFamilyConsolidationParams {
  familyId?: string | null;
  month?: string | null;
}

/**
 * RPC Transacional de Consolidação Familiar Multi-Contas (D4 / F1).
 *
 * Agrega e consolida com blindagem RLS:
 *   • Total gasto e teto orçamentário da casa;
 *   • Fatias de contribuição de cada participante;
 *   • Despesas enriquecidas com categoria e pagador (omitindo contas e cartões bancários — F3);
 *   • Status de liquidação/acerto de contas do mês e aviso de movimentações pós-acerto (F5).
 */
export async function getFamilyConsolidation(
  params?: GetFamilyConsolidationParams,
): Promise<FamilyConsolidationResult | null> {
  return unwrapRpc(
    callRpc("get_family_consolidation", {
      p_family_id: params?.familyId ?? null,
      p_month: params?.month ?? null,
    }),
    true,
  );
}

export interface CreateFamilyParams {
  name: string;
  monthlyBudget?: number | null;
  splitRule?: FamilySplitRule;
  displayName?: string | null;
  pixKey?: string | null;
  pixKeyType?: FamilyPixKeyType | null;
}

/**
 * Cria uma nova unidade familiar e vincula o criador atomicamente como proprietário (D1).
 * Invariante: participante único em família ativa (uq_family_members_user).
 */
export async function createFamily(params: CreateFamilyParams): Promise<string> {
  return unwrapRpc(
    callRpc("create_family", {
      p_name: params.name,
      p_monthly_budget: params.monthlyBudget ?? null,
      p_split_rule: params.splitRule ?? "equal",
      p_display_name: params.displayName ?? null,
      p_pix_key: params.pixKey ?? null,
      p_pix_key_type: params.pixKeyType ?? null,
    }),
  );
}

export interface InviteFamilyMemberParams {
  familyId?: string | null;
  invitedEmail?: string | null;
  role?: "member" | "admin";
  token?: string | null;
}

/**
 * Gera um convite seguro com token criptográfico e validade de 7 dias para novo parceiro/membro.
 * Autorização restrita a proprietário ou administrador da família.
 */
export async function inviteFamilyMember(
  params?: InviteFamilyMemberParams,
): Promise<InviteFamilyMemberResult> {
  return unwrapRpc(
    callRpc("invite_family_member", {
      p_family_id: params?.familyId ?? null,
      p_invited_email: params?.invitedEmail ?? null,
      p_role: params?.role ?? "member",
      p_token: params?.token ?? null,
    }),
  );
}

export interface GetFamilyInvitePreviewParams {
  token: string;
}

export interface FamilyInvitePreviewResult {
  id: string;
  family_id: string;
  invited_by: string;
  invited_email?: string | null;
  token: string;
  status: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_by?: string | null;
  accepted_at?: string | null;
  family_name: string;
  inviter_name: string;
}

/**
 * Consulta pública e segura das informações de um convite familiar via token criptográfico.
 * Retorna dados de recepção do parceiro (Zero Data Bleed).
 */
export async function getFamilyInvitePreview(
  params: GetFamilyInvitePreviewParams,
): Promise<FamilyInvitePreviewResult | null> {
  const result = await unwrapRpc(
    callRpc("get_family_invite_preview", {
      p_token: params.token,
    }),
    true,
  );
  return result as FamilyInvitePreviewResult | null;
}

export interface AcceptFamilyInviteParams {
  token: string;
  displayName?: string | null;
  pixKey?: string | null;
  pixKeyType?: FamilyPixKeyType | null;
}

/**
 * Vincula atomicamente o parceiro autenticado à família via token de convite.
 * Invariante: participante único em família ativa (rejeita se já for membro de qualquer família).
 */
export async function acceptFamilyInvite(
  params: AcceptFamilyInviteParams,
): Promise<AcceptFamilyInviteResult> {
  return unwrapRpc(
    callRpc("accept_family_invite", {
      p_token: params.token,
      p_display_name: params.displayName ?? null,
      p_pix_key: params.pixKey ?? null,
      p_pix_key_type: params.pixKeyType ?? null,
    }),
  );
}

export interface LeaveFamilyParams {
  familyId?: string | null;
  transferToUserId?: string | null;
  disband?: boolean;
}

/**
 * Desvincula o usuário da família ou dissolve a unidade caso seja o proprietário.
 * Sanitiza lançamentos e categorias para garantir Zero Data Bleed pós-saída.
 */
export async function leaveFamily(params?: LeaveFamilyParams): Promise<LeaveFamilyResult> {
  return unwrapRpc(
    callRpc("leave_family", {
      p_family_id: params?.familyId ?? null,
      p_transfer_to_user_id: params?.transferToUserId ?? null,
      p_disband: params?.disband ?? false,
    }),
  );
}

export interface RemoveFamilyMemberParams {
  familyId: string;
  targetUserId: string;
}

/**
 * Remove um membro da unidade familiar exclusivamente pelo titular.
 * Desvincula lançamentos e categorias do membro removido para garantir Zero Data Bleed.
 */
export async function removeFamilyMember(
  params: RemoveFamilyMemberParams,
): Promise<RemoveFamilyMemberResult> {
  return unwrapRpc(
    callRpc("remove_family_member", {
      p_family_id: params.familyId,
      p_target_user_id: params.targetUserId,
    }),
  );
}

export interface RecordFamilySettlementParams {
  month: string;
  payerId: string;
  receiverId: string;
  amount: number;
  familyId?: string | null;
  paymentMethod?: FamilySettlementPaymentMethod;
  notes?: string | null;
  snapshot?: Record<string, unknown>;
}

/**
 * Registra o acerto de contas auditável entre membros da família para uma competência (mês).
 */
export async function recordFamilySettlement(
  params: RecordFamilySettlementParams,
): Promise<string> {
  return unwrapRpc(
    callRpc("record_family_settlement", {
      p_month: params.month,
      p_payer_id: params.payerId,
      p_receiver_id: params.receiverId,
      p_amount: params.amount,
      p_family_id: params.familyId ?? null,
      p_payment_method: params.paymentMethod ?? "pix",
      p_notes: params.notes ?? null,
      p_snapshot: params.snapshot ?? {},
    }),
  );
}

export interface GetFamilyIncomeRatioSuggestionParams {
  familyId?: string | null;
  lookbackMonths?: number;
}

/**
 * Consulta a sugestão inteligente de rateio baseada na média de receitas dos membros nos últimos meses.
 */
export async function getFamilyIncomeRatioSuggestion(
  params?: GetFamilyIncomeRatioSuggestionParams,
): Promise<FamilyIncomeRatioSuggestionItem[]> {
  const result = await unwrapRpc(
    callRpc("get_family_income_ratio_suggestion", {
      p_family_id: params?.familyId ?? null,
      p_lookback_months: params?.lookbackMonths ?? 3,
    }),
    true,
  );
  return (result ?? []) as FamilyIncomeRatioSuggestionItem[];
}

export interface GetFamilyPortfolioSummaryParams {
  familyId?: string | null;
}

/**
 * Consolida o patrimônio e a reserva de emergência compartilhados com a família.
 */
export async function getFamilyPortfolioSummary(
  params?: GetFamilyPortfolioSummaryParams,
): Promise<FamilyPortfolioSummary | null> {
  return unwrapRpc(
    callRpc("get_family_portfolio_summary", {
      p_family_id: params?.familyId ?? null,
    }),
    true,
  );
}
