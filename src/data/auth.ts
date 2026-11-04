import { getSupabase } from "@/data/client";
import { normalizeEmail, sanitizeString } from "@/domain/validation";
import { getPublicAppUrl } from "@/lib/env";
import { AppError, classifyError, MESSAGES } from "@/services/errors";

/**
 * Operações de autenticação — camada data (integração remota).
 * Erros sempre normalizados pelo gateway (services/errors).
 */

export interface SignUpResult {
  /** true quando o fluxo exige confirmação de e-mail (sessão ainda não criada). */
  needsEmailConfirmation: boolean;
}

export async function signInWithEmail(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const { error } = await getSupabase().auth.signInWithPassword({
    email: normalized,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
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
  captchaToken?: string,
): Promise<SignUpResult> {
  const normalized = normalizeEmail(email);
  const cleanName = name ? sanitizeString(name) : "";
  const cleanInvite = inviteCode ? sanitizeString(inviteCode).toUpperCase() : "";
  const { data, error } = await getSupabase().auth.signUp({
    email: normalized,
    password,
    options: {
      data: {
        name: cleanName,
        invite_code: cleanInvite,
      },
      emailRedirectTo: getPublicAppUrl("/entrar"),
      captchaToken: captchaToken || undefined,
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


/**
 * Solicita o envio de link de recuperação/redefinição de senha para o e-mail informado (Fase 2.1).
 * Utiliza URL universal de retorno via getPublicAppUrl e validação anti-bot (captchaToken).
 */
export async function resetPasswordForEmail(
  email: string,
  captchaToken?: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const { error } = await getSupabase().auth.resetPasswordForEmail(normalized, {
    redirectTo: getPublicAppUrl("/redefinir-senha"),
    captchaToken: captchaToken || undefined,
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
  const normalized = normalizeEmail(email);
  const { error } = await getSupabase().auth.resend({
    type: "signup",
    email: normalized,
    options: {
      emailRedirectTo: getPublicAppUrl("/entrar"),
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


