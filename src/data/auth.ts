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
  const selectedMode = "investor";
  const { data, error } = await getSupabase().auth.signUp({
    email: normalized,
    password,
    options: {
      data: {
        name: cleanName,
        invite_code: cleanInvite,
        app_mode: selectedMode,
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

/**
 * Valida a senha atual do usuário ativo antes de operações sensíveis (Fase 3.1).
 * Reautentica via signInWithPassword com o e-mail da sessão atual.
 */
export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    throw new AppError("session-expired", MESSAGES["session-expired"]);
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  return !error;
}

/**
 * Altera a senha do usuário autenticado exigindo comprovação prévia da senha atual (Fase 3.1).
 * Proteção contra sequestro de conta (Account Takeover).
 */
export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const isValid = await verifyCurrentPassword(currentPassword);
  if (!isValid) {
    throw new AppError("invalid-credentials", "A senha atual informada está incorreta.");
  }
  await updateUserPassword(newPassword);
}

/**
 * Solicita a alteração do e-mail do usuário autenticado exigindo comprovação prévia da senha atual (Fase 4.2).
 * Envia e-mails de confirmação com link duplo e redirecionamento universal para a aba Minha Conta.
 */
export async function requestUserEmailChange(
  currentPassword: string,
  newEmail: string,
): Promise<void> {
  const normalized = normalizeEmail(newEmail);
  const isValid = await verifyCurrentPassword(currentPassword);
  if (!isValid) {
    throw new AppError("invalid-credentials", "A senha atual informada está incorreta.");
  }
  const { error } = await getSupabase().auth.updateUser(
    { email: normalized },
    { emailRedirectTo: getPublicAppUrl("/configuracoes?tab=conta") },
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Nível de garantia de autenticação (AAL) do Supabase Auth.
 */
export interface MfaAssuranceLevel {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
}

/**
 * Consulta o nível de autenticação atual e esperado (MFA / AAL) do usuário ativo.
 */
export async function getMfaAssuranceLevel(): Promise<MfaAssuranceLevel | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return null;
    return {
      currentLevel: (data.currentLevel as "aal1" | "aal2") ?? null,
      nextLevel: (data.nextLevel as "aal1" | "aal2") ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Consulta se o usuário ativo possui um fator TOTP de segundo fator (MFA) verificado.
 */
export async function getActiveUserMfaFactor(): Promise<{ id: string } | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  const verified = data?.totp?.find((f) => f.status === "verified");
  return verified ? { id: verified.id } : null;
}

/**
 * Valida o código TOTP de 6 dígitos informado contra o fator MFA ativo.
 */
export async function verifyMfaTotpCode(factorId: string, code: string): Promise<boolean> {
  const cleanCode = code.trim();
  if (!factorId || cleanCode.length !== 6) return false;
  const supabase = getSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: cleanCode,
  });
  return !error;
}

export interface MfaFactorInfo {
  id: string;
  status: string;
  friendly_name?: string;
  factor_type: string;
}

export interface MfaEnrollResult {
  factorId: string;
  totpUri: string;
  secret: string;
}

/**
 * Lista o fator TOTP ativo/verificado do usuário autenticado.
 */
export async function listVerifiedMfaFactors(): Promise<MfaFactorInfo | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const verified = data?.totp?.find((f) => f.status === "verified");
  return verified
    ? {
        id: verified.id,
        status: verified.status,
        friendly_name: verified.friendly_name,
        factor_type: verified.factor_type,
      }
    : null;
}

/**
 * Inicia o processo de cadastro de fator TOTP gerando a URI e o segredo.
 */
export async function enrollMfaTotp(issuer = "Axir"): Promise<MfaEnrollResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer,
  });
  if (error) throw error;
  return {
    factorId: data.id,
    totpUri: data.totp.uri,
    secret: data.totp.secret,
  };
}

/**
 * Valida o desafio do fator TOTP para finalizar a ativação de 2FA.
 */
export async function verifyMfaEnrollment(factorId: string, code: string): Promise<void> {
  const supabase = getSupabase();
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw challenge.error;

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code: code.trim(),
  });
  if (verify.error) throw verify.error;
}

/**
 * Desativa/remove um fator MFA cadastrado.
 */
export async function unenrollMfaFactor(factorId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/**
 * Autentica usuário administrativo validando atômica e estritamente o perfil na base.
 */
export async function signInAdmin(
  email: string,
  password: string,
): Promise<{ id: string; role: string }> {
  await signInWithEmail(email, password);
  const supabase = getSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) {
    throw new AppError("invalid-credentials", "Credenciais inválidas.");
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut({ scope: "local" });
    throw new AppError("permission", "Falha ao validar credencial administrativa.");
  }

  if (profile.role !== "admin" && profile.role !== "superadmin") {
    await supabase.auth.signOut({ scope: "local" });
    throw new AppError(
      "permission",
      "Acesso restrito: Esta conta não possui privilégios de operador administrativo para acessar o Console da Plataforma.",
    );
  }

  if (profile.status !== "active") {
    await supabase.auth.signOut({ scope: "local" });
    throw new AppError("permission", "Conta de administrador inativa ou suspensa.");
  }

  return { id: user.id, role: profile.role };
}

/**
 * Assina mudanças no estado de autenticação do Supabase.
 */
export function subscribeAuthStateChange(
  callback: (event: string, session: unknown) => void,
): () => void {
  const supabase = getSupabase();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return () => {
    subscription.unsubscribe();
  };
}

