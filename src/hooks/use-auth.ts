import { useEffect, useState } from "react";
import { getSupabase } from "@/data/client";
import { ensureOwnProfile } from "@/data/repositories/profiles";
import { ensureDefaultCategories } from "@/data/repositories/categories";
import { registerDevice, checkDeviceRevoked } from "@/data/repositories/devices";
import {
  getDeviceInfo,
  getOrCreateDeviceId,
  shouldSyncDeviceSession,
  markDeviceSessionSynced,
  clearDeviceSessionSync,
} from "@/services/native/device-info";
import { getErrorMessage } from "@/services/errors";
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
  enrollMfaTotp,
  verifyMfaEnrollment,
  unenrollMfaFactor,
  signInAdmin,
  subscribeAuthStateChange,
};
export type { SignUpResult, MfaAssuranceLevel, MfaFactorInfo, MfaEnrollResult };

import type { AppMode } from "@/types";

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
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string, inviteCode?: string, captchaToken?: string, appMode?: AppMode) => Promise<SignUpResult>;
  resetPassword: (email: string, captchaToken?: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
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
let isGlobalAuthInitialized = false;
const authSubscribers = new Set<(state: AuthStateSnapshot) => void>();

interface AuthStateSnapshot {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configError: string | null;
  mfaRequired: boolean;
  mfaVerified: boolean;
  aalLevel: "aal1" | "aal2" | null;
}

function updateGlobalAuthState(partial: Partial<AuthStateSnapshot>): void {
  if (partial.session !== undefined) globalSession = partial.session;
  if (partial.user !== undefined) globalUser = partial.user;
  if (partial.loading !== undefined) globalLoading = partial.loading;
  if (partial.configError !== undefined) globalConfigError = partial.configError;
  if (partial.mfaRequired !== undefined) globalMfaRequired = partial.mfaRequired;
  if (partial.mfaVerified !== undefined) globalMfaVerified = partial.mfaVerified;
  if (partial.aalLevel !== undefined) globalAalLevel = partial.aalLevel;

  const current: AuthStateSnapshot = {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
    configError: globalConfigError,
    mfaRequired: globalMfaRequired,
    mfaVerified: globalMfaVerified,
    aalLevel: globalAalLevel,
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
  });
}

async function resolveMfaState(
  supabase: ReturnType<typeof getSupabase>,
  session: Session | null,
): Promise<{
  mfaRequired: boolean;
  mfaVerified: boolean;
  aalLevel: "aal1" | "aal2" | null;
}> {
  if (!session) {
    return { mfaRequired: false, mfaVerified: false, aalLevel: null };
  }
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data) {
      const isMfaPending = data.currentLevel === "aal1" && data.nextLevel === "aal2";
      const isMfaSatisfied = data.currentLevel === "aal2";
      return {
        mfaRequired: isMfaPending || isMfaSatisfied,
        mfaVerified: isMfaSatisfied,
        aalLevel: (data.currentLevel as "aal1" | "aal2") ?? "aal1",
      };
    }
  } catch {
    // Silencia em ambiente offline / mock
  }
  return { mfaRequired: false, mfaVerified: false, aalLevel: "aal1" };
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

  if (isGlobalAuthInitialized) return;
  isGlobalAuthInitialized = true;

  void supabase.auth
    .getSession()
    .then(async ({ data }) => {
      const session = data?.session ?? null;
      const user = session?.user ?? null;
      const uid = user?.id ?? null;
      if (uid) setActiveUserId(uid);
      const mfa = await resolveMfaState(supabase, session);
      updateGlobalAuthState({ session, user, loading: false, configError: null, ...mfa });
    })
    .catch((err) => {
      updateGlobalAuthState({
        session: null,
        user: null,
        loading: false,
        configError: getErrorMessage(err),
        mfaRequired: false,
        mfaVerified: false,
        aalLevel: null,
      });
    });

  const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user ?? null;
    const uid = user?.id ?? null;
    if (uid) {
      setActiveUserId(uid);
    } else {
      setActiveUserId(null);
    }
    const mfa = await resolveMfaState(supabase, session);
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
    };
  });

  useEffect(() => {
    authSubscribers.add(setSnapshot);
    initGlobalAuth();

    return () => {
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

  // Registro e Sincronização de Dispositivos Multi-Sessão (Etapa 1.1)
  // Permite autenticar a mesma conta em múltiplos aparelhos mantendo ambos conectados.
  // Caso o aparelho atual seja revogado remotamente, encerra apenas a sessão local.
  useEffect(() => {
    const user = snapshot.user;
    if (!user || snapshot.loading) {
      if (!user) clearDeviceSessionSync();
      return;
    }

    const deviceId = getOrCreateDeviceId();

    void checkDeviceRevoked(deviceId)
      .then((isRevoked) => {
        if (isRevoked) {
          try {
            const supabase = getSupabase();
            void supabase.auth.signOut({ scope: "local" });
          } catch {
            // Silencia erro em ambiente offline
          }
          clearDeviceSessionSync();
          return;
        }

        if (shouldSyncDeviceSession()) {
          const info = getDeviceInfo();
          void registerDevice(info)
            .then(() => {
              markDeviceSessionSynced();
            })
            .catch((err) => {
              void reportError(err, { source: "syncDeviceRegistration" });
            });
        }
      })
      .catch((err) => {
        void reportError(err, { source: "checkDeviceRevoked" });
      });
  }, [snapshot.user, snapshot.loading]);

  return {
    ...snapshot,
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    resetPassword: resetPasswordForEmail,
    resendConfirmation: resendConfirmationEmail,
  };
}
