/**
 * Contratos tipados de custódia de sessão no servidor e alternância multiconta (T03).
 * Nenhuma credencial Supabase (accessToken, refreshToken) transita nestes tipos públicos.
 */

export type SessionMode = "personal" | "shared" | "operator";

export type SessionOperation =
  | "bootstrap"
  | "login"
  | "mfa"
  | "accounts"
  | "switch"
  | "open-tab"
  | "redeem-tab"
  | "logout"
  | "forget"
  | "logout-device"
  | "revalidate";

export type SessionErrorCode =
  | "unauthorized"
  | "context_stale"
  | "step_up_required"
  | "limit_reached"
  | "service_unavailable"
  | "invalid_payload"
  | "invalid_origin"
  | "forbidden_host";

export type SessionContextStatus =
  | "authenticated"
  | "mfa_required"
  | "neutral"
  | "locked"
  | "revoked"
  | "expired";

export interface SessionBridgeTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicSessionContext {
  status: SessionContextStatus;
  contextId: string | null;
  csrfToken: string | null;
  generation: number;
  revision: number;
  environment: string;
  mode: SessionMode;
  accountRef: string | null;
  displayName: string | null;
  expiresAt: number | null;
  mfaFactorId?: string | null;
  pendingRevocations?: number;
  sessionBridge?: SessionBridgeTokens;
}

export interface AccountSummary {
  accountRef: string;
  displayName: string;
  maskedEmail: string | null;
  mode: SessionMode;
  status: "active" | "remembered" | "trust_expired" | "revoked" | "requires_reauth";
  generation: number;
  lastActivityAt: number;
  hasLocalLock: boolean;
}

export interface OpenTabIntentResult {
  intentToken: string;
  expiresAt: number;
}

export interface PkceIntentStartResult {
  intentId: string;
  authorizeUrl: string;
  expiresAt: number;
}

export interface LogoutResult {
  status: "neutral";
  upstreamConfirmed: boolean;
  pendingRevocations: number;
}
