import { getSupabase } from "@/data/client";
import {
  isSessionTransportError,
  postSessionOperation,
  SessionTransportError,
  type SessionTransportErrorCode,
} from "@/data/session-transport";
import { setSessionContext } from "@/services/session-context";
import type { PublicSessionContext, SessionMode } from "@/types/session-custody";

export {
  isSessionTransportError,
  postSessionOperation,
  SessionTransportError,
  type SessionTransportErrorCode,
};

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
