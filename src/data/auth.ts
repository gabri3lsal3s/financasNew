import { getSupabase } from "@/data/client";
import { AppError, classifyError } from "@/services/errors";

/**
 * Operações de autenticação — camada data (integração remota).
 * Erros sempre normalizados pelo gateway (services/errors).
 */

export interface SignUpResult {
  /** true quando o fluxo exige confirmação de e-mail (sessão ainda não criada). */
  needsEmailConfirmation: boolean;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<SignUpResult> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: {
      data: { name: name ?? "" },
      emailRedirectTo: `${window.location.origin}/entrar`,
    },
  });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return { needsEmailConfirmation: data.session === null };
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/entrar`,
  });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

