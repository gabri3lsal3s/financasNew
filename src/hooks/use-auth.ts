import { useEffect, useState } from "react";
import { getSupabase, resetSupabaseClient } from "@/data/client";
import { subscribeSharedDeviceSessionChange } from "@/services/session-policy";
import { ensureOwnProfile } from "@/data/repositories/profiles";
import { ensureDefaultCategories } from "@/data/repositories/categories";
import { getErrorMessage } from "@/services/errors/index";
import { reportError, setObservabilityUser } from "@/services/observability";
import { setActiveUserId } from "@/services/user-storage";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Contas cujo perfil já foi garantido nesta sessão (F11) — a auto-cura é
 * best-effort e roda UMA vez por usuário, nunca a cada render.
 */
const ensuredProfiles = new Set<string>();

import {
  signInWithEmail,
  signUpWithEmail,
  resetPasswordForEmail,
  resendConfirmationEmail,
  changeUserPassword,
  requestUserEmailChange,
  updateUserPassword,
  updateMfaAdminOnlyPreference,
  verifyCurrentPassword,
  getActiveUserMfaFactor,
  verifyMfaTotpCode,
  getMfaAssuranceLevel,
  listVerifiedMfaFactors,
  enrollMfaTotp,
  verifyMfaEnrollment,
  unenrollMfaFactor,
  signInAdmin,
  subscribeAuthStateChange,
  cleanupUnverifiedMfaFactors,
  type MfaAssuranceLevel,
  type SignUpResult,
  type MfaFactorInfo,
  type MfaEnrollResult,
} from "@/data/auth";

export async function getCurrentUserMfaAdminOnly(): Promise<boolean> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data?.session?.user?.user_metadata?.mfa_admin_only === true;
  } catch {
    return false;
  }
}

export {
  signInWithEmail,
  signUpWithEmail,
  resetPasswordForEmail,
  resendConfirmationEmail,
  changeUserPassword,
  requestUserEmailChange,
  updateUserPassword,
  updateMfaAdminOnlyPreference,
  verifyCurrentPassword,
  getActiveUserMfaFactor,
  verifyMfaTotpCode,
  getMfaAssuranceLevel,
  listVerifiedMfaFactors,
  cleanupUnverifiedMfaFactors,
  enrollMfaTotp,
  verifyMfaEnrollment,
  unenrollMfaFactor,
  signInAdmin,
  subscribeAuthStateChange,
};
export type { SignUpResult, MfaAssuranceLevel, MfaFactorInfo, MfaEnrollResult };

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** true enquanto a sessão inicial é carregada (evita flash de telas). */
  loading: boolean;
  /** Erro de configuração (ex.: env incompleto) — exposto em vez de crashar. */
  configError: string | null;
  /** Flag indicando se a conta do usuário possui 2FA configurado e ativo. */
  mfaRequired?: boolean;
  /** Flag indicando se o desafio de segundo fator (AAL2) já foi verificado nesta sessão. */
  mfaVerified?: boolean;
  /** Preferência do usuário de exigir 2FA apenas no portal administrativo. */
  mfaAdminOnly?: boolean;
  /** Nível de garantia da autenticação (aal1, aal2 ou null sem sessão). */
  aalLevel?: "aal1" | "aal2" | null;
  /** Erro ao verificar estado de MFA (fail-closed quando aal !== aal2). */
  mfaError?: string | null;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string, inviteCode?: string, captchaToken?: string, redirectPath?: string) => Promise<SignUpResult>;
  resetPassword: (email: string, captchaToken?: string) => Promise<void>;
  resendConfirmation: (email: string, redirectPath?: string) => Promise<void>;
}


export function resetEnsuredProfiles(): void {
  ensuredProfiles.clear();
}

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;
let globalConfigError: string | null = null;
let globalMfaRequired = false;
let globalMfaVerified = false;
let globalMfaAdminOnly = false;
let globalAalLevel: "aal1" | "aal2" | null = null;
let globalMfaError: string | null = null;
let isGlobalAuthInitialized = false;
let authGeneration = 0;
const authSubscribers = new Set<(state: AuthStateSnapshot) => void>();

interface AuthStateSnapshot {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configError: string | null;
  mfaRequired: boolean;
  mfaVerified: boolean;
  mfaAdminOnly: boolean;
  aalLevel: "aal1" | "aal2" | null;
  mfaError: string | null;
}

function isMfaAdminOnlySession(session: Session | null): boolean {
  return session?.user?.user_metadata?.mfa_admin_only === true;
}

function updateGlobalAuthState(partial: Partial<AuthStateSnapshot>): void {
  if (partial.session !== undefined) globalSession = partial.session;
  if (partial.user !== undefined) globalUser = partial.user;
  if (partial.loading !== undefined) globalLoading = partial.loading;
  if (partial.configError !== undefined) globalConfigError = partial.configError;
  if (partial.mfaRequired !== undefined) globalMfaRequired = partial.mfaRequired;
  if (partial.mfaVerified !== undefined) globalMfaVerified = partial.mfaVerified;
  if (partial.mfaAdminOnly !== undefined) globalMfaAdminOnly = partial.mfaAdminOnly;
  if (partial.aalLevel !== undefined) globalAalLevel = partial.aalLevel;
  if (partial.mfaError !== undefined) globalMfaError = partial.mfaError;

  const current: AuthStateSnapshot = {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
    configError: globalConfigError,
    mfaRequired: globalMfaRequired,
    mfaVerified: globalMfaVerified,
    mfaAdminOnly: globalMfaAdminOnly,
    aalLevel: globalAalLevel,
    mfaError: globalMfaError,
  };

  authSubscribers.forEach((subscriber) => subscriber(current));
}

/**
 * Marca o desafio MFA (2FA) como concluído com sucesso nesta sessão (elevação para AAL2).
 */
export function markMfaVerified(): void {
  updateGlobalAuthState({
    mfaVerified: true,
    mfaRequired: false,
    aalLevel: "aal2",
    mfaError: null,
  });
}

/**
 * Reseta o estado global de 2FA em memória ao efetuar logout ou trocar de usuário.
 */
export function resetGlobalMfaState(): void {
  updateGlobalAuthState({
    mfaRequired: false,
    mfaVerified: false,
    aalLevel: null,
    mfaError: null,
  });
}

/**
 * Limpa imediatamente a sessão global em memória (fallback garantido no logout
 * caso `supabase.auth.signOut` sofra timeout ou erro em WebView/rede instável).
 */
export function clearGlobalAuthSession(): void {
  updateGlobalAuthState({
    session: null,
    user: null,
    loading: false,
    mfaRequired: false,
    mfaVerified: false,
    mfaAdminOnly: false,
    aalLevel: null,
    mfaError: null,
  });
}

const INVALID_SESSION_KEYWORDS = [
  "jwt",
  "expired",
  "invalid",
  "session_not_found",
  "user from sub claim",
  "unauthorized",
  "refresh_token",
] as const;

function isInvalidSessionError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "string") {
    const lower = err.toLowerCase();
    return INVALID_SESSION_KEYWORDS.some((kw) => lower.includes(kw));
  }
  if (typeof err !== "object") return false;

  const record = err as { status?: unknown; message?: unknown; code?: unknown };
  if (record.status === 401 || record.status === 403) {
    return true;
  }

  const message = typeof record.message === "string" ? record.message : "";
  const code = typeof record.code === "string" ? record.code : "";
  const combined = `${message} ${code}`.toLowerCase();
  if (!combined.trim()) return false;

  return INVALID_SESSION_KEYWORDS.some((kw) => combined.includes(kw));
}

function isSessionExpiringSoon(session: Session | null): boolean {
  if (!session?.expires_at) return false;
  return session.expires_at * 1000 <= Date.now() + 30_000;
}

async function clearLocalAuthSession(supabase: ReturnType<typeof getSupabase>): Promise<void> {
  if (typeof supabase?.auth?.signOut === "function") {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }
  setActiveUserId(null);
  clearGlobalAuthSession();
}

/**
 * Reavalia forçadamente o estado de MFA da sessão atual (ex.: após desativação ou ativação de 2FA).
 */
export async function refreshMfaState(): Promise<void> {
  try {
    const supabase = getSupabase();
    let session: Session | null = null;
    let didAttemptRefresh = false;

    const shouldRefreshBeforeGetSession =
      globalMfaError !== null || isSessionExpiringSoon(globalSession);

    if (shouldRefreshBeforeGetSession && typeof supabase.auth.refreshSession === "function") {
      didAttemptRefresh = true;
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError && isInvalidSessionError(refreshError)) {
        await clearLocalAuthSession(supabase);
        return;
      }
      if (!refreshError && refreshedData?.session) {
        session = refreshedData.session;
      }
    }

    if (!session) {
      const { data, error } = await supabase.auth.getSession();
      if (error && isInvalidSessionError(error)) {
        await clearLocalAuthSession(supabase);
        return;
      }
      session = data?.session ?? null;

      if (
        session &&
        isSessionExpiringSoon(session) &&
        !didAttemptRefresh &&
        typeof supabase.auth.refreshSession === "function"
      ) {
        didAttemptRefresh = true;
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError && isInvalidSessionError(refreshError)) {
          await clearLocalAuthSession(supabase);
          return;
        }
        if (!refreshError && refreshedData?.session) {
          session = refreshedData.session;
        }
      }
    }

    const resolved = await resolveSessionWithMfaRecovery(supabase, session, !didAttemptRefresh);
    if (resolved.user?.id) {
      setActiveUserId(resolved.user.id);
    }
    updateGlobalAuthState({
      session: resolved.session,
      user: resolved.user,
      mfaRequired: resolved.mfaRequired,
      mfaVerified: resolved.mfaVerified,
      aalLevel: resolved.aalLevel,
      mfaError: resolved.mfaError,
      mfaAdminOnly: isMfaAdminOnlySession(resolved.session),
    });
  } catch (err) {
    if (isInvalidSessionError(err)) {
      try {
        await clearLocalAuthSession(getSupabase());
      } catch {
        setActiveUserId(null);
        clearGlobalAuthSession();
      }
      return;
    }
    // Silencia em ambiente offline / mock
  }
}

function parseJwtAalBaseline(accessToken?: string): "aal1" | "aal2" | null {
  if (!accessToken || typeof accessToken !== "string") return null;
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = (parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { aal?: unknown; amr?: Array<{ method?: string }> };
    if (payload.aal === "aal2") return "aal2";
    if (Array.isArray(payload.amr) && payload.amr.some((item) => item?.method === "totp")) {
      return "aal2";
    }
    if (payload.aal === "aal1") return "aal1";
  } catch {
    return null;
  }
  return null;
}

interface MfaResolution {
  mfaRequired: boolean;
  mfaVerified: boolean;
  aalLevel: "aal1" | "aal2" | null;
  mfaError: string | null;
  invalidSession?: boolean;
}

interface SessionMfaResolution {
  session: Session | null;
  user: User | null;
  mfaRequired: boolean;
  mfaVerified: boolean;
  aalLevel: "aal1" | "aal2" | null;
  mfaError: string | null;
}

function buildMfaFailureFallback(
  jwtAal: "aal1" | "aal2" | null,
  isInvalid: boolean,
): MfaResolution {
  if (jwtAal === "aal2") {
    return { mfaRequired: false, mfaVerified: true, aalLevel: "aal2", mfaError: null };
  }
  if (isInvalid) {
    return {
      mfaRequired: false,
      mfaVerified: false,
      aalLevel: null,
      mfaError: null,
      invalidSession: true,
    };
  }
  return {
    mfaRequired: false,
    mfaVerified: false,
    aalLevel: jwtAal ?? "aal1",
    mfaError: "Não foi possível validar o segundo fator (MFA). Tente novamente.",
  };
}

async function resolveMfaState(
  supabase: ReturnType<typeof getSupabase>,
  session: Session | null,
): Promise<MfaResolution> {
  if (!session) {
    return { mfaRequired: false, mfaVerified: false, aalLevel: null, mfaError: null };
  }

  const jwtAal = parseJwtAalBaseline(session.access_token);

  try {
    const [aalResult, factorsResult] = await Promise.all([
      session.access_token
        ? supabase.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
        : supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    if (aalResult.error || factorsResult.error) {
      const invalid =
        isInvalidSessionError(aalResult.error) || isInvalidSessionError(factorsResult.error);
      return buildMfaFailureFallback(jwtAal, invalid);
    }

    const aalData = aalResult.data;
    const factorsData = factorsResult.data;

    const allFactors = (factorsData?.all ?? []) as Array<{ factor_type: string; status: string }>;
    const totpFactors = (factorsData?.totp ?? []) as Array<{ factor_type: string; status: string }>;
    const hasVerifiedTotp = Boolean(
      allFactors.some((f) => f.factor_type === "totp" && f.status === "verified") ||
      totpFactors.some((f) => f.status === "verified") ||
      allFactors.some((f) => f.status === "verified")
    );

    const currentLevel = (aalData?.currentLevel as "aal1" | "aal2") ?? jwtAal ?? "aal1";
    const nextLevel = (aalData?.nextLevel as "aal1" | "aal2") ?? (hasVerifiedTotp ? "aal2" : "aal1");

    const isMfaSatisfied = currentLevel === "aal2";
    const isMfaPending = hasVerifiedTotp && !isMfaSatisfied;

    return {
      mfaRequired: isMfaPending || (nextLevel === "aal2" && !isMfaSatisfied),
      mfaVerified: isMfaSatisfied,
      aalLevel: currentLevel,
      mfaError: null,
    };
  } catch (err) {
    return buildMfaFailureFallback(jwtAal, isInvalidSessionError(err));
  }
}

async function resolveSessionWithMfaRecovery(
  supabase: ReturnType<typeof getSupabase>,
  session: Session | null,
  allowRefresh = true,
): Promise<SessionMfaResolution> {
  const mfa = await resolveMfaState(supabase, session);
  if (!mfa.invalidSession) {
    return {
      session,
      user: session?.user ?? null,
      mfaRequired: mfa.mfaRequired,
      mfaVerified: mfa.mfaVerified,
      aalLevel: mfa.aalLevel,
      mfaError: mfa.mfaError,
    };
  }

  if (allowRefresh && typeof supabase.auth.refreshSession === "function") {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      const refreshedSession = !error ? (data?.session ?? null) : null;
      if (refreshedSession) {
        const refreshedMfa = await resolveMfaState(supabase, refreshedSession);
        if (!refreshedMfa.invalidSession) {
          if (refreshedSession.user?.id) {
            setActiveUserId(refreshedSession.user.id);
          }
          return {
            session: refreshedSession,
            user: refreshedSession.user ?? null,
            mfaRequired: refreshedMfa.mfaRequired,
            mfaVerified: refreshedMfa.mfaVerified,
            aalLevel: refreshedMfa.aalLevel,
            mfaError: refreshedMfa.mfaError,
          };
        }
      }
    } catch {
      // Falha no refresh — segue para limpeza local da sessão
    }
  }

  await clearLocalAuthSession(supabase);
  return {
    session: null,
    user: null,
    mfaRequired: false,
    mfaVerified: false,
    aalLevel: null,
    mfaError: null,
  };
}

let globalAuthSubscription: { unsubscribe: () => void } | null = null;

function initGlobalAuth(): void {
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch (err) {
    updateGlobalAuthState({ configError: getErrorMessage(err), loading: false });
    return;
  }

  if (!supabase?.auth || typeof supabase.auth.getSession !== "function") {
    updateGlobalAuthState({ loading: false });
    return;
  }

  if (isGlobalAuthInitialized) return;
  isGlobalAuthInitialized = true;

  const bootstrapGen = ++authGeneration;
  void supabase.auth
    .getSession()
    .then(async ({ data }) => {
      if (bootstrapGen !== authGeneration) return;
      const session = data?.session ?? null;
      const uid = session?.user?.id ?? null;
      if (uid) setActiveUserId(uid);
      const resolved = await resolveSessionWithMfaRecovery(supabase, session);
      if (bootstrapGen !== authGeneration) return;
      updateGlobalAuthState({
        session: resolved.session,
        user: resolved.user,
        loading: false,
        configError: null,
        mfaAdminOnly: isMfaAdminOnlySession(resolved.session),
        mfaRequired: resolved.mfaRequired,
        mfaVerified: resolved.mfaVerified,
        aalLevel: resolved.aalLevel,
        mfaError: resolved.mfaError,
      });
    })
    .catch((err) => {
      if (bootstrapGen !== authGeneration) return;
      updateGlobalAuthState({
        session: null,
        user: null,
        loading: false,
        configError: getErrorMessage(err),
        mfaRequired: false,
        mfaVerified: false,
        mfaAdminOnly: false,
        aalLevel: null,
        mfaError: null,
      });
    });

  const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const eventGen = ++authGeneration;
    const uid = session?.user?.id ?? null;
    if (uid) {
      setActiveUserId(uid);
    } else {
      setActiveUserId(null);
    }
    const resolved = await resolveSessionWithMfaRecovery(supabase, session);
    if (eventGen !== authGeneration) return;
    updateGlobalAuthState({
      session: resolved.session,
      user: resolved.user,
      loading: false,
      configError: null,
      mfaAdminOnly: isMfaAdminOnlySession(resolved.session),
      mfaRequired: resolved.mfaRequired,
      mfaVerified: resolved.mfaVerified,
      aalLevel: resolved.aalLevel,
      mfaError: resolved.mfaError,
    });
  });

  globalAuthSubscription = authListener?.subscription ?? null;
}

/**
 * Sessão do usuário — fonte única para guards de rota e telas de auth.
 * Opera como singleton reativo compartilhado em memória para que todos os
 * componentes montados na árvore acessem a sessão ativa imediatamente.
 */
export function useAuth(): AuthState {
  const [snapshot, setSnapshot] = useState<AuthStateSnapshot>(() => {
    let configError: string | null = null;
    try {
      getSupabase();
    } catch (err) {
      configError = getErrorMessage(err);
      globalConfigError = configError;
      globalLoading = false;
    }

    return {
      session: globalSession,
      user: globalUser,
      loading: configError ? false : globalLoading,
      configError: configError ?? globalConfigError,
      mfaRequired: globalMfaRequired,
      mfaVerified: globalMfaVerified,
      mfaAdminOnly: globalMfaAdminOnly,
      aalLevel: globalAalLevel,
      mfaError: globalMfaError,
    };
  });

  useEffect(() => {
    authSubscribers.add(setSnapshot);
    initGlobalAuth();

    const unsubscribeSharedMode = subscribeSharedDeviceSessionChange(() => {
      if (globalAuthSubscription) {
        globalAuthSubscription.unsubscribe();
        globalAuthSubscription = null;
      }
      isGlobalAuthInitialized = false;
      authGeneration += 1;
      if (typeof resetSupabaseClient === "function") {
        resetSupabaseClient();
      }
      updateGlobalAuthState({
        session: null,
        user: null,
        loading: true,
        mfaRequired: false,
        mfaVerified: false,
        mfaAdminOnly: false,
        aalLevel: null,
        mfaError: null,
      });
      initGlobalAuth();
    });

    return () => {
      unsubscribeSharedMode();
      authSubscribers.delete(setSnapshot);
      if (authSubscribers.size === 0 && globalAuthSubscription) {
        globalAuthSubscription.unsubscribe();
        globalAuthSubscription = null;
        isGlobalAuthInitialized = false;
      }
    };
  }, []);

  // Sincroniza observabilidade apenas após a resolução da autenticação (F6.3)
  useEffect(() => {
    if (snapshot.loading) return;
    const uid = snapshot.user?.id ?? null;
    if (uid) {
      setActiveUserId(uid);
    }
    void setObservabilityUser(snapshot.user ? { id: snapshot.user.id, email: snapshot.user.email } : null);
  }, [snapshot.user, snapshot.loading]);

  // Auto-cura do perfil (F11) e categorias padrão: contas órfãs sem profiles ou categorias
  useEffect(() => {
    const user = snapshot.user;
    if (!user || ensuredProfiles.has(user.id)) return;
    ensuredProfiles.add(user.id);
    void ensureOwnProfile(user.id, user.email, user.user_metadata?.name)
      .then(() => ensureDefaultCategories(user.id))
      .catch((err) => {
        void reportError(err, { source: "ensureOwnProfile_ensureDefaultCategories" });
      });
  }, [snapshot.user]);

  return {
    ...snapshot,
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    resetPassword: resetPasswordForEmail,
    resendConfirmation: resendConfirmationEmail,
  };
}
