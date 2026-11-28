import { getSupabase } from "@/data/client";
import {
  isSessionTransportError,
  postSessionOperation,
  SessionTransportError,
  type SessionTransportErrorCode,
} from "@/data/session-transport";
import { setSessionContext } from "@/services/session-context";
import { setActiveUserId } from "@/services/user-storage";
import type { PublicSessionContext, SessionBridgeTokens, SessionMode } from "@/types/session-custody";

export {
  isSessionTransportError,
  postSessionOperation,
  SessionTransportError,
  type SessionBridgeTokens,
  type SessionTransportErrorCode,
};

export function extractSessionBridge(raw: unknown): SessionBridgeTokens | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const rootBridge = record.sessionBridge;
  const contextBridge =
    record.context && typeof record.context === "object"
      ? (record.context as Record<string, unknown>).sessionBridge
      : undefined;
  const candidate =
    rootBridge && typeof rootBridge === "object"
      ? (rootBridge as Record<string, unknown>)
      : contextBridge && typeof contextBridge === "object"
        ? (contextBridge as Record<string, unknown>)
        : null;
  if (!candidate) return null;
  if (
    typeof candidate.accessToken === "string" &&
    candidate.accessToken.trim() !== "" &&
    typeof candidate.refreshToken === "string" &&
    candidate.refreshToken.trim() !== ""
  ) {
    return {
      accessToken: candidate.accessToken,
      refreshToken: candidate.refreshToken,
    };
  }
  return null;
}

export function stripSessionBridge(context: PublicSessionContext): PublicSessionContext {
  if ("sessionBridge" in context) {
    const clean = { ...context } as PublicSessionContext & { sessionBridge?: unknown };
    delete clean.sessionBridge;
    return clean;
  }
  return context;
}

/**
 * Hidrata o cliente Supabase local com os tokens efêmeros devolvidos pelo BFF
 * (`switch` / `redeem-tab`) e atualiza o usuário ativo no storage escopado.
 */
export async function hydrateSupabaseSessionFromBridge(
  bridge?: SessionBridgeTokens | null,
): Promise<boolean> {
  if (!bridge || !bridge.accessToken?.trim() || !bridge.refreshToken?.trim()) {
    return false;
  }
  try {
    const { data, error } = await getSupabase().auth.setSession({
      access_token: bridge.accessToken,
      refresh_token: bridge.refreshToken,
    });
    if (error || !data.session?.user?.id) {
      return false;
    }
    setActiveUserId(data.session.user.id);
    return true;
  } catch {
    return false;
  }
}

function extractPublicContext(raw: unknown): PublicSessionContext | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const candidate =
    obj.context && typeof obj.context === "object"
      ? (obj.context as Record<string, unknown>)
      : obj;
  if (typeof candidate.contextId !== "string" && candidate.status !== "neutral") {
    return null;
  }
  return candidate as unknown as PublicSessionContext;
}

/**
 * Sincroniza a sessão Supabase já autenticada (após login/MFA) com o BFF
 * usando validação server-side via `/auth/v1/user`, sem re-consumir Turnstile.
 */
export async function syncCurrentSupabaseSessionToBff(
  mode: Extract<SessionMode, "personal" | "shared"> = "personal",
): Promise<PublicSessionContext | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return null;

    const raw = await postSessionOperation<PublicSessionContext | { context: PublicSessionContext }>(
      "login",
      {
        grant: "session-sync",
        mode,
        accessToken,
        refreshToken: data.session?.refresh_token || "sync",
      },
    );
    const ctx = extractPublicContext(raw);
    if (ctx) {
      setSessionContext(ctx);
    }
    return ctx;
  } catch {
    return null;
  }
}
