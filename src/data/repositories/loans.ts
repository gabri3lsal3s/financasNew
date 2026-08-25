import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { Loan } from "@/types";

/**
 * Mapeia linhas do banco convertendo campos numéricos.
 */
function mapLoan(row: Loan): Loan {
  return {
    ...row,
    principal_amount: Number(row.principal_amount),
    interest_rate_monthly: Number(row.interest_rate_monthly),
    total_installments: Number(row.total_installments),
  };
}

/** Lista todos os contratos de empréstimo/financiamento do usuário. */
export async function listLoans(): Promise<Loan[]> {
  const { data, error } = await resolveQuery<Loan[]>(
    getSupabase().from("loans").select("*").order("created_at", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapLoan);
}

/** Busca um contrato por ID. */
export async function getLoan(id: string): Promise<Loan | null> {
  const { data, error } = await resolveQuery<Loan>(
    getSupabase().from("loans").select("*").eq("id", id).maybeSingle(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ? mapLoan(data) : null;
}

/** Exclusão de contrato de empréstimo. */
export async function deleteLoan(id: string): Promise<void> {
  const { error } = await getSupabase().from("loans").delete().eq("id", id);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/** Atualização segura de metadados do contrato (nome, tipo, observações). */
export async function updateLoan(id: string, patch: Partial<Pick<Loan, "name" | "loan_type" | "notes">>): Promise<Loan> {
  const { data, error } = await resolveQuery<Loan>(
    getSupabase().from("loans").update(patch).eq("id", id).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return mapLoan(data);
}
