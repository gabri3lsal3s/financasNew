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

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** true enquanto a sessão inicial é carregada (evita flash de telas). */
  loading: boolean;
  /** Erro de configuração (ex.: env incompleto) — exposto em vez de crashar. */
  configError: string | null;
}

type AuthInit = { supabase: ReturnType<typeof getSupabase> } | { configError: string };

export function resetEnsuredProfiles(): void {
  ensuredProfiles.clear();
}

/**
 * Sessão do usuário — fonte única para guards de rota e telas de auth.
 * O cliente é inicializado de forma lazy (env validado fora do effect);
 * a assinatura `onAuthStateChange` acontece uma única vez (Online First).
 */
export function useAuth(): AuthState {
  const [init] = useState<AuthInit>(() => {
    try {
      return { supabase: getSupabase() };
    } catch (err) {
      return { configError: getErrorMessage(err) };
    }
  });

  const [state, setState] = useState<AuthState>(() =>
    "supabase" in init
      ? { session: null, user: null, loading: true, configError: null }
      : { session: null, user: null, loading: false, configError: init.configError },
  );

  // Correlaciona erros ao usuário no Sentry (no-op sem DSN) — F6.3 e sincroniza storage.
  useEffect(() => {
    const uid = state.user?.id ?? null;
    setActiveUserId(uid);
    void setObservabilityUser(state.user ? { id: state.user.id, email: state.user.email } : null);
  }, [state.user]);

  // Auto-cura do perfil (F11): conta órfã sem linha em `profiles` faz TODAS
  // as escritas falharem na FK user_id → profiles ("Dados inválidos").
  // Disparo único por usuário, assíncrono e sem estado de UI.
  useEffect(() => {
    const user = state.user;
    if (!user || ensuredProfiles.has(user.id)) return;
    ensuredProfiles.add(user.id);
    void ensureOwnProfile(user.id, user.email, user.user_metadata?.name).catch((err) => {
      void reportError(err, { source: "ensureOwnProfile" });
    });
  }, [state.user]);

  useEffect(() => {
    if (!("supabase" in init)) return;
    let active = true;

    void init.supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const uid = data.session?.user?.id ?? null;
      setActiveUserId(uid);
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
        configError: null,
      });
    });

    const { data: subscription } = init.supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const uid = session?.user?.id ?? null;
      setActiveUserId(uid);
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        configError: null,
      });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [init]);

  return state;
}
