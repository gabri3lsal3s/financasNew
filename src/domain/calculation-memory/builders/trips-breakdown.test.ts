import { describe, expect, it } from "vitest";
import { buildTripSettlementBreakdown } from "./trips-breakdown";
import type { TripMemberBalance } from "@/types/trips";

describe("trips-breakdown", () => {
  it("deve montar breakdown de acerto de viagem para viajante credor", () => {
    const member: TripMemberBalance = {
      memberId: "m1",
      name: "Lucas",
      totalPaidCents: 120000, // R$ 1.200,00 pago
      totalOwedCents: 40000, // R$ 400,00 devido
      netBalanceCents: 80000, // R$ 800,00 a receber
      settlementsPaidCents: 0,
      settlementsReceivedCents: 0,
    };

    const breakdown = buildTripSettlementBreakdown(member, {
      tripTitle: "Viagem Praia",
      totalTripExpensesCents: 240000,
    });

    expect(breakdown.title).toBe("Acerto da Viagem: Lucas");
    expect(breakdown.result.label).toBe("A Receber via Pix");
    expect(breakdown.result.rawValue).toBe(80000);
    expect(breakdown.steps[0]?.rawValue).toBe(240000); // Total consolidado
    expect(breakdown.steps[1]?.rawValue).toBe(120000); // Total pago
    expect(breakdown.steps[2]?.rawValue).toBe(40000); // Cota devida
    expect(breakdown.steps[3]?.rawValue).toBe(80000); // Balanço
    expect(breakdown.copyText).toContain("A Receber via Pix: R$ 800,00");
  });

  it("deve montar breakdown de acerto de viagem considerando acertos parciais já efetuados", () => {
    const member: TripMemberBalance = {
      memberId: "m2",
      name: "Mariana",
      totalPaidCents: 20000, // R$ 200,00 pago
      totalOwedCents: 60000, // R$ 600,00 devido
      netBalanceCents: -20000, // - R$ 200,00 pendente (pois já pagou 200 de acerto)
      settlementsPaidCents: 20000, // Já transferiu 200
      settlementsReceivedCents: 0,
    };

    const breakdown = buildTripSettlementBreakdown(member, {
      tripTitle: "Viagem Montanha",
    });

    expect(breakdown.title).toBe("Acerto da Viagem: Mariana");
    expect(breakdown.result.label).toBe("A Transferir via Pix");
    expect(breakdown.result.rawValue).toBe(20000);
    expect(breakdown.steps).toHaveLength(4);
    expect(breakdown.steps[3]?.label).toBe("Acertos / Pix já Transferidos");
    expect(breakdown.steps[3]?.rawValue).toBe(20000);
  });
});
