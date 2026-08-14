import { useEffect, useState } from "react";
import { getSupabase } from "@/data/client";
import { getErrorMessage } from "@/services/errors";
import { setObservabilityUser } from "@/services/observability";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** true enquanto a sessão inicial é carregada (evita flash de telas). */
  loading: boolean;
  /** Erro de configuração (ex.: env incompleto) — exposto em vez de crashar. */
  configError: string | null;
}

type AuthInit = { supabase: ReturnType<typeof getSupabase> } | { configError: string };

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

  // Correlaciona erros ao usuário no Sentry (no-op sem DSN) — F6.3.
  useEffect(() => {
    void setObservabilityUser(state.user ? { id: state.user.id, email: state.user.email } : null);
  }, [state.user]);

  useEffect(() => {
    if (!("supabase" in init)) return;
    let active = true;

    void init.supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
        configError: null,
      });
    });

    const { data: subscription } = init.supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
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
