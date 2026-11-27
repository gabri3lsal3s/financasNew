import { getSupabase } from "@/data/client";
import { unwrapRpc, type RpcResult } from "./client";
import type { getMySubscription } from "./admin";
import type { Profile, UserPreferences } from "@/types";

export type RawMySubscriptionRpc = NonNullable<Awaited<ReturnType<typeof getMySubscription>>>;

export interface SessionBootstrapPayload {
  profile: Profile | null;
  features: Record<string, boolean>;
  subscription: RawMySubscriptionRpc | null;
  preferences: UserPreferences | null;
}

/**
 * Consulta consolidada de bootstrap da sessão autenticada (`get_my_session_bootstrap`).
 * Retorna perfil, feature flags, assinatura e preferências em 1 único roundtrip.
 */
export async function getMySessionBootstrap(): Promise<SessionBootstrapPayload | null> {
  const promise = getSupabase().rpc(
    "get_my_session_bootstrap" as never,
    {} as never,
  ) as unknown as PromiseLike<RpcResult<SessionBootstrapPayload>>;
  return unwrapRpc<SessionBootstrapPayload>(promise, true);
}
