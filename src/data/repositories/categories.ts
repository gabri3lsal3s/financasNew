import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { Category, CategoryType } from "@/types";

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
