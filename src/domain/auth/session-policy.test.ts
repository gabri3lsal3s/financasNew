import { describe, expect, it } from "vitest";
import {
  canAdmitPersonalAccount,
  computeSessionDeadlines,
  evaluateSwitchPreconditions,
  isSessionExpired,
  maskEmailForSwitcher,
  resolveMonotonicRevision,
  SESSION_POLICY,
} from "./session-policy";

describe("domain/auth/session-policy (T03)", () => {
  const t0 = 1_700_000_000_000;

  it("impõe teto de 5 contas pessoais e permite reautenticação de conta existente", () => {
    const five = ["acc-1", "acc-2", "acc-3", "acc-4", "acc-5"];
    expect(canAdmitPersonalAccount(five, "acc-6")).toEqual({ allowed: false, code: "limit_reached" });
    expect(canAdmitPersonalAccount(five, "acc-3")).toEqual({ allowed: true });
    expect(canAdmitPersonalAccount(["acc-1"], "acc-2")).toEqual({ allowed: true });
  });

  it("calcula prazos com prevalência do menor limite em modo compartilhado e operador", () => {
    const shared = { mode: "shared" as const, createdAt: t0, lastActivityAt: t0, lastAuthProofAt: t0 };
    expect(isSessionExpired(shared, t0 + SESSION_POLICY.SHARED_IDLE_TTL_MS - 1)).toBe(false);
    expect(isSessionExpired(shared, t0 + SESSION_POLICY.SHARED_IDLE_TTL_MS)).toBe(true);

    const nearAbsolute = {
      mode: "operator" as const,
      createdAt: t0,
      lastActivityAt: t0 + SESSION_POLICY.OPERATOR_ABSOLUTE_TTL_MS - 60_000,
      lastAuthProofAt: t0,
    };
    expect(computeSessionDeadlines(nearAbsolute).effectiveExpiresAt).toBe(
      t0 + SESSION_POLICY.OPERATOR_ABSOLUTE_TTL_MS,
    );
  });

  it("valida pré-condições de troca (geração esperada, MFA, trava local e status)", () => {
    const activeTarget = {
      accountRef: "acc-b",
      displayName: "Conta B",
      maskedEmail: "be***@axir.com.br",
      mode: "personal" as const,
      status: "active" as const,
      generation: 3,
      lastActivityAt: t0,
      hasLocalLock: true,
    };

    expect(
      evaluateSwitchPreconditions({
        target: activeTarget,
        expectedGeneration: 2,
        mfaSatisfied: true,
        localLockSatisfied: true,
      }),
    ).toEqual({ ok: false, code: "context_stale" });

    expect(
      evaluateSwitchPreconditions({
        target: activeTarget,
        expectedGeneration: 3,
        mfaSatisfied: true,
        localLockSatisfied: false,
      }),
    ).toEqual({ ok: false, code: "step_up_required" });

    expect(
      evaluateSwitchPreconditions({
        target: { ...activeTarget, status: "requires_reauth" },
        expectedGeneration: 3,
        mfaSatisfied: true,
        localLockSatisfied: true,
      }),
    ).toEqual({ ok: false, code: "unauthorized" });

    expect(
      evaluateSwitchPreconditions({
        target: activeTarget,
        expectedGeneration: 3,
        mfaSatisfied: true,
        localLockSatisfied: true,
      }),
    ).toEqual({ ok: true });
  });

  it("rejeita revisão ambígua ou concorrente exigindo nova autenticação", () => {
    expect(resolveMonotonicRevision(4, 4, false)).toEqual({ ok: true, nextRevision: 5 });
    expect(resolveMonotonicRevision(4, 4, true)).toEqual({
      ok: false,
      requiresReauth: true,
      code: "context_stale",
    });
    expect(resolveMonotonicRevision(5, 4, false)).toEqual({
      ok: false,
      requiresReauth: true,
      code: "context_stale",
    });
  });

  it("mascara e-mail sem expor endereço completo", () => {
    expect(maskEmailForSwitcher("gabriel@axir.com.br")).toBe("ga***@axir.com.br");
    expect(maskEmailForSwitcher("a@axir.com.br")).toBe("a***@axir.com.br");
    expect(maskEmailForSwitcher(null)).toBeNull();
  });
});
