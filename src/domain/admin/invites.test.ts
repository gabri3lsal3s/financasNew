import { describe, expect, it } from "vitest";
import { generateInviteCode, validateInvite } from "./invites";
import type { AccessInvite } from "@/types";

describe("invites domain engine", () => {
  const baseInvite: AccessInvite = {
    id: "inv-1",
    code: "GF-TEST-1234",
    max_uses: 5,
    used_count: 2,
    is_revoked: false,
    created_at: "2026-01-01T00:00:00Z",
  };

  it("deve gerar código com prefixo e formato correto", () => {
    const code = generateInviteCode("VIP");
    expect(code).toMatch(/^VIP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("deve validar convite ativo e disponível", () => {
    const res = validateInvite(baseInvite);
    expect(res.valid).toBe(true);
  });

  it("deve rejeitar convite nulo", () => {
    const res = validateInvite(null);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("não encontrado");
  });

  it("deve rejeitar convite revogado", () => {
    const res = validateInvite({ ...baseInvite, is_revoked: true });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("revogado");
  });

  it("deve rejeitar convite com limite de usos esgotado", () => {
    const res = validateInvite({ ...baseInvite, max_uses: 3, used_count: 3 });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("limite máximo");
  });

  it("deve rejeitar convite expirado", () => {
    const pastDate = new Date("2026-01-01T00:00:00Z");
    const currentDate = new Date("2026-08-23T00:00:00Z");
    const res = validateInvite(
      { ...baseInvite, expires_at: pastDate.toISOString() },
      undefined,
      currentDate,
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("expirado");
  });

  it("deve rejeitar e-mail divergente se target_email estiver preenchido", () => {
    const targeted = { ...baseInvite, target_email: "autorizado@gmail.com" };
    const res = validateInvite(targeted, "outro@gmail.com");
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("autorizado@gmail.com");

    const validRes = validateInvite(targeted, "autorizado@gmail.com");
    expect(validRes.valid).toBe(true);
  });

  it("deve extrair plano e benefício do convite", () => {
    const lifetimeInvite: AccessInvite = {
      ...baseInvite,
      target_tier: "lifetime",
    };
    const res = validateInvite(lifetimeInvite);
    expect(res.valid).toBe(true);
    expect(res.target_tier).toBe("lifetime");
    expect(res.benefitDescription).toBe("Convite VIP: Acesso Vitalício Total");

    const extendedTrialInvite: AccessInvite = {
      ...baseInvite,
      target_tier: "trial",
      custom_trial_days: 60,
    };
    const trialRes = validateInvite(extendedTrialInvite);
    expect(trialRes.benefitDescription).toBe("Teste Pro estendido por 60 dias");
  });
});
