/**
 * Políticas puras de custódia, TTL, admissão e revisão monotônica de sessão (T03).
 * Sem imports de UI ou Supabase.
 */

import type { AccountSummary, SessionErrorCode, SessionMode } from "@/types/session-custody";

export const SESSION_POLICY = {
  MAX_PERSONAL_ACCOUNTS: 5,
  PERSONAL_TRUST_WINDOW_MS: 7 * 24 * 60 * 60 * 1000,
  PERSONAL_ABSOLUTE_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  REMEMBERED_ACCOUNT_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  SHARED_IDLE_TTL_MS: 30 * 60 * 1000,
  SHARED_ABSOLUTE_TTL_MS: 8 * 60 * 60 * 1000,
  OPERATOR_IDLE_TTL_MS: 30 * 60 * 1000,
  OPERATOR_ABSOLUTE_TTL_MS: 8 * 60 * 60 * 1000,
  OPERATOR_STEP_UP_TTL_MS: 5 * 60 * 1000,
  OPEN_TAB_INTENT_TTL_MS: 60 * 1000,
  PKCE_INTENT_TTL_MS: 10 * 60 * 1000,
  REVALIDATION_POLL_MS: 15 * 1000,
} as const;

export interface SessionTtlSnapshot {
  mode: SessionMode;
  createdAt: number;
  lastActivityAt: number;
  lastAuthProofAt: number;
}

export interface ComputedDeadlines {
  idleExpiresAt: number | null;
  trustExpiresAt: number | null;
  absoluteExpiresAt: number;
  effectiveExpiresAt: number;
}

export function computeSessionDeadlines(snapshot: SessionTtlSnapshot): ComputedDeadlines {
  if (snapshot.mode === "shared") {
    const idleExpiresAt = snapshot.lastActivityAt + SESSION_POLICY.SHARED_IDLE_TTL_MS;
    const absoluteExpiresAt = snapshot.createdAt + SESSION_POLICY.SHARED_ABSOLUTE_TTL_MS;
    return {
      idleExpiresAt,
      trustExpiresAt: null,
      absoluteExpiresAt,
      effectiveExpiresAt: Math.min(idleExpiresAt, absoluteExpiresAt),
    };
  }

  if (snapshot.mode === "operator") {
    const idleExpiresAt = snapshot.lastActivityAt + SESSION_POLICY.OPERATOR_IDLE_TTL_MS;
    const absoluteExpiresAt = snapshot.createdAt + SESSION_POLICY.OPERATOR_ABSOLUTE_TTL_MS;
    return {
      idleExpiresAt,
      trustExpiresAt: null,
      absoluteExpiresAt,
      effectiveExpiresAt: Math.min(idleExpiresAt, absoluteExpiresAt),
    };
  }

  const trustExpiresAt = snapshot.lastAuthProofAt + SESSION_POLICY.PERSONAL_TRUST_WINDOW_MS;
  const absoluteExpiresAt = snapshot.createdAt + SESSION_POLICY.PERSONAL_ABSOLUTE_TTL_MS;
  return {
    idleExpiresAt: null,
    trustExpiresAt,
    absoluteExpiresAt,
    effectiveExpiresAt: Math.min(trustExpiresAt, absoluteExpiresAt),
  };
}

export function isSessionExpired(snapshot: SessionTtlSnapshot, nowMs: number): boolean {
  const { effectiveExpiresAt } = computeSessionDeadlines(snapshot);
  return nowMs >= effectiveExpiresAt;
}

export function canAdmitPersonalAccount(
  existingPersonalAccountRefs: readonly string[],
  candidateAccountRef: string,
): { allowed: true } | { allowed: false; code: "limit_reached" } {
  if (existingPersonalAccountRefs.includes(candidateAccountRef)) {
    return { allowed: true };
  }
  if (existingPersonalAccountRefs.length >= SESSION_POLICY.MAX_PERSONAL_ACCOUNTS) {
    return { allowed: false, code: "limit_reached" };
  }
  return { allowed: true };
}

export interface SwitchPreconditionInput {
  target: AccountSummary | null;
  expectedGeneration: number;
  mfaSatisfied: boolean;
  localLockSatisfied: boolean;
}

export function evaluateSwitchPreconditions(
  input: SwitchPreconditionInput,
): { ok: true } | { ok: false; code: SessionErrorCode } {
  if (!input.target) {
    return { ok: false, code: "unauthorized" };
  }
  if (input.target.status === "revoked" || input.target.status === "trust_expired" || input.target.status === "requires_reauth") {
    return { ok: false, code: "unauthorized" };
  }
  if (input.target.generation !== input.expectedGeneration) {
    return { ok: false, code: "context_stale" };
  }
  if (!input.mfaSatisfied || (input.target.hasLocalLock && !input.localLockSatisfied)) {
    return { ok: false, code: "step_up_required" };
  }
  return { ok: true };
}

export function resolveMonotonicRevision(
  currentRevision: number,
  expectedRevision: number,
  refreshInFlight: boolean,
): { ok: true; nextRevision: number } | { ok: false; requiresReauth: true; code: "context_stale" } {
  if (refreshInFlight || currentRevision !== expectedRevision) {
    return { ok: false, requiresReauth: true, code: "context_stale" };
  }
  return { ok: true, nextRevision: currentRevision + 1 };
}

export function maskEmailForSwitcher(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf("@");
  if (atIdx <= 0) return null;
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  if (!domain) return null;
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}
