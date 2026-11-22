/**
 * Repositório de Compartilhamentos Públicos (public-shares.ts).
 *
 * Gerencia tokens seguros para Racha de Contas (/r/:token), Orçamento Familiar
 * e Metas Coletivas. Isolamento estrito de dados e conformidade RLS.
 */

import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { createExpenseWithDebt, getPublicShareByTokenRpc, getSharedFamilyBudget, getSharedGoalTracker } from "@/data/rpc";
import { createCategory, listCategories } from "./categories";
import { createDebt } from "./debts";
import { saveGroupTarget } from "./allocation-targets";
import { setGoal } from "./income-goals";
import { AppError, classifyError } from "@/services/errors";
import type {
  PublicShare,
  PublicShareKind,
  DbInsert,
  DbUpdate,
  SharedFamilyBudgetResult,
  SharedGoalTrackerResult,
} from "@/types";
import { generateShareToken, sanitizeShareToken } from "@/domain/share/token";
import type { PendingSimulation } from "@/domain/share/simulation-transport";

export interface CreatePublicShareInput {
  kind: PublicShareKind;
  token?: string;
  payload: Record<string, unknown>;
  expiresInDays?: number;
  expiresAt?: string | null;
  expenseId?: string | null;
  installmentGroupId?: string | null;
  debtId?: string | null;
}

function mapPublicShare(row: Record<string, unknown>): PublicShare {
  const payload = (row.payload as Record<string, unknown>) ?? {};
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    kind: row.kind as PublicShareKind,
    token: String(row.token),
    payload,
    created_at: String(row.created_at),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    is_revoked: Boolean(row.is_revoked),
    updated_at: String(row.updated_at),
    expense_id: row.expense_id
      ? String(row.expense_id)
      : typeof payload.expense_id === "string"
        ? payload.expense_id
        : null,
    installment_group_id: row.installment_group_id
      ? String(row.installment_group_id)
      : typeof payload.installment_group_id === "string"
        ? payload.installment_group_id
        : null,
    debt_id: row.debt_id
      ? String(row.debt_id)
      : typeof payload.debt_id === "string"
        ? payload.debt_id
        : null,
  };
}

/**
 * Cria um novo registro de compartilhamento público com token único.
 */
export async function createPublicShare(input: CreatePublicShareInput): Promise<PublicShare> {
  const user_id = await currentUserId();
  const token = input.token || generateShareToken();

  const days = input.expiresInDays ?? 30;
  const expiresAt =
    input.expiresAt !== undefined
      ? input.expiresAt
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const extractedExpenseId =
    input.expenseId !== undefined
      ? input.expenseId
      : typeof input.payload.expense_id === "string" && input.payload.expense_id
        ? input.payload.expense_id
        : undefined;
  const extractedGroupId =
    input.installmentGroupId !== undefined
      ? input.installmentGroupId
      : typeof input.payload.installment_group_id === "string" && input.payload.installment_group_id
        ? input.payload.installment_group_id
        : undefined;
  const extractedDebtId =
    input.debtId !== undefined
      ? input.debtId
      : typeof input.payload.debt_id === "string" && input.payload.debt_id
        ? input.payload.debt_id
        : undefined;

  const insertPayload: DbInsert<PublicShare> = {
    user_id,
    kind: input.kind,
    token,
    payload: input.payload,
    expires_at: expiresAt,
    is_revoked: false,
    ...(extractedExpenseId ? { expense_id: extractedExpenseId } : {}),
    ...(extractedGroupId ? { installment_group_id: extractedGroupId } : {}),
    ...(extractedDebtId ? { debt_id: extractedDebtId } : {}),
  };

  const { data, error } = await resolveQuery<Record<string, unknown>>(
    getSupabase()
      .from("public_shares")
      .insert(insertPayload)
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  if (!data) {
    throw new AppError("unknown", "Falha ao criar compartilhamento público.", null);
  }

  return mapPublicShare(data);
}

function isArchivedSplitShare(share: PublicShare): boolean {
  const payload = share.payload as Record<string, unknown> | undefined;
  return (
    share.kind === "split" &&
    (Boolean(payload?.is_completed) || Boolean(payload?.public_page_paused))
  );
}

/**
 * Consulta um compartilhamento público válido pelo seu token.
 * Retorna null se não encontrado, se revogado, se expirado ou se for um racha finalizado/arquivado.
 */
export async function getPublicShareByToken(token: string): Promise<PublicShare | null> {
  const cleanToken = sanitizeShareToken(token);
  if (!cleanToken) return null;

  try {
    const rpcResult = await getPublicShareByTokenRpc({ token: cleanToken });
    if (rpcResult) {
      const share = mapPublicShare(rpcResult);
      if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
        return null;
      }
      if (isArchivedSplitShare(share)) {
        return null;
      }
      return share;
    }
  } catch (error) {
    // Se a RPC falhar por qualquer motivo (ex: em mocks ou antes da migration ser aplicada),
    // prossegue para a consulta direta por compatibilidade.
    if (import.meta.env.DEV) {
      console.warn("Falha na chamada da RPC get_public_share_by_token, tentando fallback direto:", error);
    }
  }

  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("public_shares")
      .select("*")
      .eq("token", cleanToken)
      .eq("is_revoked", false)
      .limit(1),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  const row = data?.[0];
  if (!row) return null;

  const share = mapPublicShare(row);
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return null;
  }
  if (isArchivedSplitShare(share)) {
    return null;
  }

  return share;
}

/**
 * Revoga um link público para que deixe de ser acessível imediatamente.
 */
export async function revokePublicShare(id: string): Promise<void> {
  const { error } = await resolveQuery(
    getSupabase()
      .from("public_shares")
      .update({ is_revoked: true, updated_at: new Date().toISOString() })
      .eq("id", id),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Reativa um link público previamente revogado (is_revoked: false).
 */
export async function restorePublicShare(id: string): Promise<void> {
  const { error } = await resolveQuery(
    getSupabase()
      .from("public_shares")
      .update({ is_revoked: false, updated_at: new Date().toISOString() })
      .eq("id", id),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Exclui permanentemente um registro de compartilhamento público.
 */
export async function deletePublicShare(id: string): Promise<void> {
  const { error } = await resolveQuery(
    getSupabase()
      .from("public_shares")
      .delete()
      .eq("id", id),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

export interface UpdatePublicShareOptions {
  isRevoked?: boolean;
  expiresAt?: string | null;
  expenseId?: string | null;
  installmentGroupId?: string | null;
  debtId?: string | null;
}

/**
 * Atualiza o payload de um compartilhamento público existente (ex.: registrar contribuições ou alterar status).
 * Opcionalmente sincroniza `is_revoked`, `expires_at` e chaves relacionais na mesma operação.
 */
export async function updatePublicSharePayload(
  id: string,
  payload: Record<string, unknown>,
  options?: UpdatePublicShareOptions,
): Promise<PublicShare> {
  const updateData: DbUpdate<PublicShare> = {
    payload,
    updated_at: new Date().toISOString(),
    ...(options?.isRevoked !== undefined ? { is_revoked: options.isRevoked } : {}),
    ...(options?.expiresAt !== undefined ? { expires_at: options.expiresAt } : {}),
    ...(options?.expenseId !== undefined ? { expense_id: options.expenseId } : {}),
    ...(options?.installmentGroupId !== undefined ? { installment_group_id: options.installmentGroupId } : {}),
    ...(options?.debtId !== undefined ? { debt_id: options.debtId } : {}),
  };

  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("public_shares")
      .update(updateData)
      .eq("id", id)
      .select("*"),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  const row = data?.[0];
  if (!row) {
    throw new AppError("unknown", "Falha ao atualizar compartilhamento público.", null);
  }

  return mapPublicShare(row);
}



/**
 * Lista todos os links públicos gerados pelo usuário autenticado.
 */
export async function listMyPublicShares(kind?: PublicShareKind): Promise<PublicShare[]> {
  const user_id = await currentUserId();
  let query = getSupabase()
    .from("public_shares")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (kind) {
    query = query.eq("kind", kind);
  }

  const { data, error } = await resolveQuery<Record<string, unknown>[]>(query);

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return (data ?? []).map(mapPublicShare);
}

/**
 * Localiza se já existe um racha vinculado à despesa ou ao grupo de parcelas do usuário.
 */
export async function findSplitShareByExpenseOrGroup(
  expenseId?: string | null,
  installmentGroupId?: string | null,
): Promise<PublicShare | null> {
  if (!expenseId && !installmentGroupId) return null;
  const shares = await listMyPublicShares("split");
  return (
    shares.find((share) => {
      const p = share.payload ?? {};
      const matchExp = Boolean(expenseId && (share.expense_id === expenseId || p.expense_id === expenseId));
      const matchGrp = Boolean(
        installmentGroupId &&
          (share.installment_group_id === installmentGroupId || p.installment_group_id === installmentGroupId),
      );
      return matchExp || matchGrp;
    }) ?? null
  );
}

export interface SaveSplitExpenseInput {
  title?: string | null;
  amountCents: number;
  date?: string | null;
  categoryId?: string | null;
}

/**
 * Salva a despesa de um racha de conta diretamente no extrato do usuário autenticado.
 * Resolve automaticamente categoria compatível (ou cria categoria padrão de Alimentação).
 */
export async function saveSplitExpenseToAccount(input: SaveSplitExpenseInput): Promise<string> {
  let categoryId = input.categoryId;

  if (!categoryId) {
    const categories = await listCategories("expense").catch(() => []);
    const preferred =
      categories.find(
        (c) =>
          c.name.toLowerCase().includes("alimenta") ||
          c.name.toLowerCase().includes("lazer") ||
          c.name.toLowerCase().includes("restaurante") ||
          c.name.toLowerCase().includes("outros") ||
          c.name.toLowerCase().includes("geral"),
      ) || categories[0];

    categoryId = preferred?.id;

    if (!categoryId) {
      const created = await createCategory({
        type: "expense",
        name: "Alimentação",
        icon: "alimentacao",
        color: "#DDA726",
      }).catch(() => null);
      categoryId = created?.id;
    }
  }

  if (!categoryId) {
    throw new AppError("validation", "Nenhuma categoria de despesa disponível para registrar o racha.");
  }

  const value = input.amountCents / 100;
  const date = input.date || new Date().toISOString().slice(0, 10);
  const installments = [
    {
      date,
      value,
      billCompetence: null,
    },
  ];

  return createExpenseWithDebt({
    value,
    date,
    categoryId,
    paymentMethod: "pix",
    cardId: null,
    description: input.title?.trim() ? input.title : "Racha de Despesa",
    reportWeight: 1,
    installments,
  });
}

/**
 * Consulta o orçamento familiar consolidado pelo token de compartilhamento.
 */
export async function getSharedFamilyBudgetByToken(
  token: string,
  month?: string | null,
): Promise<SharedFamilyBudgetResult | null> {
  const cleanToken = sanitizeShareToken(token);
  if (!cleanToken) return null;
  return getSharedFamilyBudget({ token: cleanToken, month });
}

/**
 * Consulta o termômetro de meta coletiva consolidado pelo token de compartilhamento.
 */
export async function getSharedGoalTrackerByToken(
  token: string,
): Promise<SharedGoalTrackerResult | null> {
  const cleanToken = sanitizeShareToken(token);
  if (!cleanToken) return null;
  return getSharedGoalTracker({ token: cleanToken });
}


/**
 * Regenera o link de um compartilhamento público existente mantendo o mesmo registro,
 * invalidando o token anterior e atualizando payload/expiração se fornecidos.
 */
export async function regeneratePublicShare(
  oldId: string,
  input: CreatePublicShareInput,
): Promise<PublicShare> {
  const token = input.token || generateShareToken();
  const days = input.expiresInDays ?? 30;
  const expiresAt =
    input.expiresAt !== undefined
      ? input.expiresAt
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const updateData: DbUpdate<PublicShare> = {
    token,
    is_revoked: false,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
    ...(input.payload ? { payload: input.payload } : {}),
  };

  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("public_shares")
      .update(updateData)
      .eq("id", oldId)
      .select("*"),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  const row = data?.[0];
  if (!row) {
    throw new AppError("unknown", "Falha ao regenerar link público.", null);
  }

  return mapPublicShare(row);
}

/**
 * Salva e transporta os parâmetros de uma simulação financeira executada
 * nos simuladores abertos para a conta autenticada do usuário.
 */
export async function saveSimulationToAccount(simulation: PendingSimulation): Promise<void> {
  if (simulation.type === "debt_simulator") {
    const debts = simulation.debts ?? [];
    if (debts.length === 0) return;

    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(now.getDate(), 28))
      .toISOString()
      .slice(0, 10);

    for (const debt of debts) {
      if (!debt.name || debt.balanceCents <= 0) continue;
      await createDebt({
        name: debt.name,
        amount: debt.balanceCents / 100,
        due_date: dueDate,
        type: "payable",
      });
    }
  } else if (simulation.type === "rebalance_simulator") {
    const classes = simulation.classes ?? [];
    if (classes.length === 0) return;

    for (const cls of classes) {
      if (!cls.name || cls.targetPercent <= 0) continue;
      await saveGroupTarget("class", cls.name, cls.targetPercent);
    }
  } else if (simulation.type === "compound_interest") {
    const contributionCents = simulation.monthlyContributionCents ?? 0;
    if (contributionCents <= 0) return;

    const month = new Date().toISOString().slice(0, 7);
    const categories = await listCategories("income").catch(() => []);
    let targetCat =
      categories.find(
        (c) =>
          c.name.toLowerCase().includes("invest") ||
          c.name.toLowerCase().includes("meta") ||
          c.name.toLowerCase().includes("aporte") ||
          c.name.toLowerCase().includes("outros"),
      ) || categories[0];

    if (!targetCat) {
      const created = await createCategory({
        type: "income",
        name: "Investimentos & Metas",
        icon: "investimentos",
        color: "#3B82F6",
      }).catch(() => null);
      targetCat = created ?? undefined;
    }

    if (targetCat) {
      await setGoal(targetCat.id, month, contributionCents / 100);
    }
  }
}



