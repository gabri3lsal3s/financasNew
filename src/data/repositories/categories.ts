import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { deleteCategoryMigrate } from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { Category, CategoryType, DbUpdate } from "@/types";

/**
 * Categorias — integração remota.
 * Conversão de borda: campos numéricos chegam do PostgREST como string
 * (numeric) e são convertidos aqui (contrato de domínio = number).
 */

function mapCategory(row: Category): Category {
  return row;
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
}): Promise<Category> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<Category>(
    getSupabase()
      .from("categories")
      .insert({
        ...input,
        icon: input.icon ?? null,
        color: input.color ?? null,
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

/** Categoria reservada de estorno (renda automática) — se existir. */
export async function findReservedCategory(type: CategoryType, name: string): Promise<Category | null> {
  const { data, error } = await resolveQuery<Category | null>(
    getSupabase().from("categories").select("*").eq("type", type).eq("name", name).eq("is_reserved", true).maybeSingle(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ? mapCategory(data) : null;
}
