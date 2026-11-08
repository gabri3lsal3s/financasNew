/**
 * Repositório de Compartilhamentos Públicos (public-shares.ts).
 *
 * Gerencia tokens seguros para Racha de Contas (/r/:token), Orçamento Familiar
 * e Metas Coletivas. Isolamento estrito de dados e conformidade RLS.
 */

import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { createExpenseWithDebt, getSharedFamilyBudget, getSharedGoalTracker } from "@/data/rpc";
import { createCategory, listCategories } from "./categories";
import { createDebt } from "./debts";
import { saveGroupTarget } from "./allocation-targets";
import { setGoal } from "./income-goals";
import { AppError, classifyError } from "@/services/errors";
import type {
  PublicShare,
  PublicShareKind,
  DbInsert,
  SharedFamilyBudgetResult,
  SharedGoalTrackerResult,
} from "@/types";
import { generateShareToken } from "@/domain/share/token";
import type { PendingSimulation } from "@/domain/share/simulation-transport";

export interface CreatePublicShareInput {
  kind: PublicShareKind;
  token?: string;
  payload: Record<string, unknown>;
  expiresInDays?: number;
}

function mapPublicShare(row: Record<string, unknown>): PublicShare {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    kind: row.kind as PublicShareKind,
    token: String(row.token),
    payload: (row.payload as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    is_revoked: Boolean(row.is_revoked),
    updated_at: String(row.updated_at),
  };
}

/**
 * Cria um novo registro de compartilhamento público com token único.
 */
export async function createPublicShare(input: CreatePublicShareInput): Promise<PublicShare> {
  const user_id = await currentUserId();
  const token = input.token || generateShareToken();

  const days = input.expiresInDays ?? 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const insertPayload: DbInsert<PublicShare> = {
    user_id,
    kind: input.kind,
    token,
    payload: input.payload,
    expires_at: expiresAt,
    is_revoked: false,
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

/**
 * Consulta um compartilhamento público válido pelo seu token.
 * Retorna null se não encontrado, se revogado ou se expirado.
 */
export async function getPublicShareByToken(token: string): Promise<PublicShare | null> {
  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("public_shares")
      .select("*")
      .eq("token", token)
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

/**
 * Atualiza o payload de um compartilhamento público existente (ex.: registrar contribuições ou alterar status).
 */
export async function updatePublicSharePayload(
  id: string,
  payload: Record<string, unknown>,
): Promise<PublicShare> {
  const { data, error } = await resolveQuery<Record<string, unknown>[]>(
    getSupabase()
      .from("public_shares")
      .update({ payload, updated_at: new Date().toISOString() })
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
  return getSharedFamilyBudget({ token, month });
}

/**
 * Consulta o termômetro de meta coletiva consolidado pelo token de compartilhamento.
 */
export async function getSharedGoalTrackerByToken(
  token: string,
): Promise<SharedGoalTrackerResult | null> {
  return getSharedGoalTracker({ token });
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
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const updateData: Record<string, unknown> = {
    token,
    is_revoked: false,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  if (input.payload) {
    updateData.payload = input.payload;
  }

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



