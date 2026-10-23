import { getSupabase } from "@/data/client";
import { AppError, classifyError, MESSAGES } from "@/services/errors";

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

export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string,
  inviteCode?: string,
): Promise<SignUpResult> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name ?? "",
        invite_code: inviteCode?.trim().toUpperCase() ?? "",
      },
      emailRedirectTo: `${window.location.origin}/entrar`,
    },
  });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  // Blindagem contra falso positivo da flag anti-enumeração do Supabase:
  // Se a conta já existe, o endpoint retorna HTTP 200 com array identities vazio.
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    throw new AppError("user-already-exists", MESSAGES["user-already-exists"], data.user);
  }

  return { needsEmailConfirmation: data.session === null };
}


export async function resetPasswordForEmail(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Reenvia o e-mail de confirmação de cadastro para contas pendentes de ativação (Fase 2.1).
 */
export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/entrar`,
    },
  });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Atualiza a senha do usuário em sessão ativa (troca preventiva ou recuperação de senha) (Fase 3.2).
 */
export async function updateUserPassword(newPassword: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}


