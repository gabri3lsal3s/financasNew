import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { deleteCategoryMigrate } from "@/data/rpc";
import { CANONICAL_DEFAULT_CATEGORIES } from "@/domain/budgets";
import { AppError, classifyError } from "@/services/errors";
import type { Category, CategoryType, DbUpdate } from "@/types";

/**
 * Categorias — integração remota.
 * Conversão de borda: campos numéricos chegam do PostgREST como string
 * (numeric) e são convertidos aqui (contrato de domínio = number).
 */

function mapCategory(row: Category): Category {
  return {
    ...row,
    is_family: Boolean(row.is_family),
  };
}

export async function listCategories(type?: CategoryType): Promise<Category[]> {
  let query = getSupabase().from("categories").select("*").eq("is_active", true).order("name");

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await resolveQuery<Category[]>(query);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapCategory);
}

/** Todas as categorias (ativas e inativas) — gestão de categorias. */
export async function listAllCategories(type?: CategoryType): Promise<Category[]> {
  let query = getSupabase().from("categories").select("*").order("name");
  if (type) query = query.eq("type", type);

  const { data, error } = await resolveQuery<Category[]>(query);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapCategory);
}

export async function createCategory(input: {
  type: CategoryType;
  name: string;
  icon?: string | null;
  color?: string | null;
  is_family?: boolean;
  family_id?: string | null;
}): Promise<Category> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<Category>(
    getSupabase()
      .from("categories")
      .insert({
        ...input,
        icon: input.icon ?? null,
        color: input.color ?? null,
        is_family: Boolean(input.is_family),
        family_id: input.family_id ?? null,
        user_id,
        is_active: true,
        is_reserved: false,
      })
      .select()
      .single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar categoria.", null);
  }
  return mapCategory(data);
}

export async function updateCategory(id: string, input: DbUpdate<Category>): Promise<Category> {
  const { data, error } = await resolveQuery<Category>(
    getSupabase().from("categories").update(input).eq("id", id).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Categoria não encontrada para atualização.", null);
  }
  return mapCategory(data);
}

/** Exclusão com migração opcional (RPC `delete_category_migrate`) — §3.5.1. */
export async function deleteCategory(id: string, migrateTo?: string | null): Promise<void> {
  await deleteCategoryMigrate(id, migrateTo);
}

/** Contagem de lançamentos (despesas + rendas) usando a categoria — para o fluxo de migração. */
export async function getCategoryUsage(categoryId: string): Promise<{ expenses: number; incomes: number }> {
  const [expenses, incomes] = await Promise.all([
    getSupabase().from("expenses").select("id", { count: "exact", head: true }).eq("category_id", categoryId),
    getSupabase().from("incomes").select("id", { count: "exact", head: true }).eq("category_id", categoryId),
  ]);
  if (expenses.error) {
    const classified = classifyError(expenses.error);
    throw new AppError(classified.kind, classified.message, expenses.error);
  }
  if (incomes.error) {
    const classified = classifyError(incomes.error);
    throw new AppError(classified.kind, classified.message, incomes.error);
  }
  return { expenses: expenses.count ?? 0, incomes: incomes.count ?? 0 };
}

/**
 * Inicializa ou restaura as 11 categorias padrão brasileiras (§4.1).
 * Usa RPC `seed_default_categories` transacional e idempotente;
 * Se o RPC falhar por ausência de migração remota, faz fallback direto
 * via batch upsert ignorando duplicatas (onConflict: "user_id,type,name").
 */
export async function seedDefaultCategories(): Promise<number> {
  const supabase = getSupabase();
  const { data: rpcCount, error: rpcError } = await supabase.rpc("seed_default_categories" as never);

  if (!rpcError && typeof rpcCount === "number") {
    return rpcCount;
  }

  // Fallback caso a migração da RPC ainda não tenha sido aplicada no Supabase remoto
  const userId = await currentUserId();
  const rows = CANONICAL_DEFAULT_CATEGORIES.map((seed) => ({
    user_id: userId,
    type: seed.type,
    name: seed.name,
    icon: seed.icon,
    color: seed.color,
    is_reserved: false,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("categories")
    .upsert(rows, { onConflict: "user_id,type,name", ignoreDuplicates: true })
    .select("id");

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return (data ?? []).length;
}

/**
 * Auto-cura de categorias de novo usuário:
 * Verifica se o usuário autenticado possui ao menos uma categoria não-reservada.
 * Se possuir 0 (ex.: conta recém-criada onde a trigger do banco não rodou,
 * ou contendo apenas a categoria de sistema 'Estorno'), injeta o catálogo padrão.
 * Retorna true se efetuou o seed, false se o usuário já possuía categorias.
 */
export async function ensureDefaultCategories(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_reserved", false);

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  if ((count ?? 0) === 0) {
    await seedDefaultCategories();
    return true;
  }

  return false;
}

