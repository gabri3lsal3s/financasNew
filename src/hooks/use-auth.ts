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

export {
  signInWithEmail,
  signUpWithEmail,
  resetPasswordForEmail,
  resendConfirmationEmail,
  changeUserPassword,
  requestUserEmailChange,
  updateUserPassword,
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
  aalLevel: "aal1" | "aal2" | null;
  mfaError: string | null;
}

function updateGlobalAuthState(partial: Partial<AuthStateSnapshot>): void {
  if (partial.session !== undefined) globalSession = partial.session;
  if (partial.user !== undefined) globalUser = partial.user;
  if (partial.loading !== undefined) globalLoading = partial.loading;
  if (partial.configError !== undefined) globalConfigError = partial.configError;
  if (partial.mfaRequired !== undefined) globalMfaRequired = partial.mfaRequired;
  if (partial.mfaVerified !== undefined) globalMfaVerified = partial.mfaVerified;
  if (partial.aalLevel !== undefined) globalAalLevel = partial.aalLevel;
  if (partial.mfaError !== undefined) globalMfaError = partial.mfaError;

  const current: AuthStateSnapshot = {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
    configError: globalConfigError,
    mfaRequired: globalMfaRequired,
    mfaVerified: globalMfaVerified,
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
    aalLevel: null,
    mfaError: null,
  });
}

/**
 * Reavalia forçadamente o estado de MFA da sessão atual (ex.: após desativação ou ativação de 2FA).
 */
export async function refreshMfaState(): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const session = data?.session ?? null;
    const mfa = await resolveMfaState(supabase, session);
    updateGlobalAuthState(mfa);
  } catch {
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

async function resolveMfaState(
  supabase: ReturnType<typeof getSupabase>,
  session: Session | null,
): Promise<{
  mfaRequired: boolean;
  mfaVerified: boolean;
  aalLevel: "aal1" | "aal2" | null;
  mfaError: string | null;
}> {
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
      if (jwtAal === "aal2") {
        return { mfaRequired: false, mfaVerified: true, aalLevel: "aal2", mfaError: null };
      }
      return {
        mfaRequired: false,
        mfaVerified: false,
        aalLevel: jwtAal ?? "aal1",
        mfaError: "Não foi possível validar o segundo fator (MFA). Tente novamente.",
      };
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
  } catch {
    if (jwtAal === "aal2") {
      return { mfaRequired: false, mfaVerified: true, aalLevel: "aal2", mfaError: null };
    }
    return {
      mfaRequired: false,
      mfaVerified: false,
      aalLevel: jwtAal ?? "aal1",
      mfaError: "Falha de comunicação ao verificar segundo fator (MFA).",
    };
  }
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
      const user = session?.user ?? null;
      const uid = user?.id ?? null;
      if (uid) setActiveUserId(uid);
      const mfa = await resolveMfaState(supabase, session);
      if (bootstrapGen !== authGeneration) return;
      updateGlobalAuthState({ session, user, loading: false, configError: null, ...mfa });
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
        aalLevel: null,
        mfaError: null,
      });
    });

  const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const eventGen = ++authGeneration;
    const user = session?.user ?? null;
    const uid = user?.id ?? null;
    if (uid) {
      setActiveUserId(uid);
    } else {
      setActiveUserId(null);
    }
    const mfa = await resolveMfaState(supabase, session);
    if (eventGen !== authGeneration) return;
    updateGlobalAuthState({ session, user, loading: false, configError: null, ...mfa });
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
