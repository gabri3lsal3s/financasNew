import { useEffect, useState } from "react";
import { getSupabase } from "@/data/client";
import { ensureOwnProfile } from "@/data/repositories/profiles";
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
  type SignUpResult,
} from "@/data/auth";

export { signInWithEmail, signUpWithEmail, resetPasswordForEmail };
export type { SignUpResult };

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** true enquanto a sessão inicial é carregada (evita flash de telas). */
  loading: boolean;
  /** Erro de configuração (ex.: env incompleto) — exposto em vez de crashar. */
  configError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string, inviteCode?: string) => Promise<SignUpResult>;
  resetPassword: (email: string) => Promise<void>;
}


export function resetEnsuredProfiles(): void {
  ensuredProfiles.clear();
}

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;
let globalConfigError: string | null = null;
let isGlobalAuthInitialized = false;
const authSubscribers = new Set<(state: AuthStateSnapshot) => void>();

interface AuthStateSnapshot {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configError: string | null;
}

function updateGlobalAuthState(partial: Partial<AuthStateSnapshot>): void {
  if (partial.session !== undefined) globalSession = partial.session;
  if (partial.user !== undefined) globalUser = partial.user;
  if (partial.loading !== undefined) globalLoading = partial.loading;
  if (partial.configError !== undefined) globalConfigError = partial.configError;

  const current: AuthStateSnapshot = {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
    configError: globalConfigError,
  };

  authSubscribers.forEach((subscriber) => subscriber(current));
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
    };
  });

  useEffect(() => {
    authSubscribers.add(setSnapshot);
    return () => {
      authSubscribers.delete(setSnapshot);
    };
  }, []);

  // Inicialização única da sessão do Supabase Auth
  useEffect(() => {
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
      .then(({ data }) => {
        const session = data?.session ?? null;
        const user = session?.user ?? null;
        const uid = user?.id ?? null;
        if (uid) setActiveUserId(uid);
        updateGlobalAuthState({ session, user, loading: false, configError: null });
      })
      .catch((err) => {
        updateGlobalAuthState({ session: null, user: null, loading: false, configError: getErrorMessage(err) });
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      const uid = user?.id ?? null;
      if (uid) {
        setActiveUserId(uid);
      } else {
        setActiveUserId(null);
      }
      updateGlobalAuthState({ session, user, loading: false, configError: null });
    });

    return () => {
      authListener?.subscription?.unsubscribe();
      isGlobalAuthInitialized = false;
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

  // Auto-cura do perfil (F11): conta órfã sem linha em `profiles`
  useEffect(() => {
    const user = snapshot.user;
    if (!user || ensuredProfiles.has(user.id)) return;
    ensuredProfiles.add(user.id);
    void ensureOwnProfile(user.id, user.email, user.user_metadata?.name).catch((err) => {
      void reportError(err, { source: "ensureOwnProfile" });
    });
  }, [snapshot.user]);

  return {
    ...snapshot,
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    resetPassword: resetPasswordForEmail,
  };
}
