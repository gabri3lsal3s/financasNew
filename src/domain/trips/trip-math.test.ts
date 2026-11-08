import { describe, it, expect } from "vitest";
import {
  calculateEqualSplits,
  calculateMemberBalances,
  calculateSimplifiedSettlements,
  calculateLinkedExpenseWeight,
} from "./trip-math";

describe("trip-math: calculateEqualSplits", () => {
  it("divide valor exato sem resto de centavos", () => {
    const result = calculateEqualSplits({
      totalAmountCents: 30000, // R$ 300,00
      memberIds: ["m1", "m2", "m3"],
      payerMemberId: "m1",
    });

    expect(result).toHaveLength(3);
    expect(result[0]?.shareCents).toBe(10000);
    expect(result[1]?.shareCents).toBe(10000);
    expect(result[2]?.shareCents).toBe(10000);

    const sum = result.reduce((acc, r) => acc + r.shareCents, 0);
    expect(sum).toBe(30000);
  });

  it("aloca resto de centavos determinísticamente ao pagador", () => {
    const result = calculateEqualSplits({
      totalAmountCents: 10000, // R$ 100,00 entre 3 pessoas = 33,33 x 3 + 0,01
      memberIds: ["m1", "m2", "m3"],
      payerMemberId: "m2",
    });

    expect(result).toHaveLength(3);
    expect(result.find((r) => r.memberId === "m1")?.shareCents).toBe(3333);
    expect(result.find((r) => r.memberId === "m2")?.shareCents).toBe(3334); // pagador absorve o 1 centavo
    expect(result.find((r) => r.memberId === "m3")?.shareCents).toBe(3333);

    const sum = result.reduce((acc, r) => acc + r.shareCents, 0);
    expect(sum).toBe(10000);
  });

  it("distribui resto entre os primeiros membros caso pagador não esteja na lista", () => {
    const result = calculateEqualSplits({
      totalAmountCents: 10000,
      memberIds: ["m1", "m2", "m3"],
    });

    expect(result).toHaveLength(3);
    expect(result[0]?.shareCents).toBe(3334);
    expect(result[1]?.shareCents).toBe(3333);
    expect(result[2]?.shareCents).toBe(3333);

    const sum = result.reduce((acc, r) => acc + r.shareCents, 0);
    expect(sum).toBe(10000);
  });

  it("retorna vazio se não houver membros ou o valor for zero", () => {
    expect(
      calculateEqualSplits({ totalAmountCents: 0, memberIds: ["m1"] })
    ).toEqual([]);
    expect(
      calculateEqualSplits({ totalAmountCents: 1000, memberIds: [] })
    ).toEqual([]);
  });
});

describe("trip-math: calculateMemberBalances", () => {
  it("computa saldos líquidos corretamente com soma zero", () => {
    const members = [
      { id: "m1", name: "Gabriel" },
      { id: "m2", name: "Pedro" },
      { id: "m3", name: "Tiago" },
    ];

    // Despesa 1: Gabriel paga R$ 600 (R$ 200 para cada)
    // Despesa 2: Pedro paga R$ 300 (R$ 100 para cada)
    const expenses = [
      {
        paid_by_member_id: "m1",
        amount_cents: 60000,
        splits: [
          { member_id: "m1", share_cents: 20000 },
          { member_id: "m2", share_cents: 20000 },
          { member_id: "m3", share_cents: 20000 },
        ],
      },
      {
        paid_by_member_id: "m2",
        amount_cents: 30000,
        splits: [
          { member_id: "m1", share_cents: 10000 },
          { member_id: "m2", share_cents: 10000 },
          { member_id: "m3", share_cents: 10000 },
        ],
      },
    ];

    const balances = calculateMemberBalances(members, expenses);

    // Gabriel: pagou 600, deve 300 (200 + 100) -> saldo +300
    // Pedro: pagou 300, deve 300 (200 + 100) -> saldo 0
    // Tiago: pagou 0, deve 300 (200 + 100) -> saldo -300
    expect(balances).toHaveLength(3);
    const bGabriel = balances.find((b) => b.memberId === "m1");
    const bPedro = balances.find((b) => b.memberId === "m2");
    const bTiago = balances.find((b) => b.memberId === "m3");

    expect(bGabriel?.netBalanceCents).toBe(30000);
    expect(bPedro?.netBalanceCents).toBe(0);
    expect(bTiago?.netBalanceCents).toBe(-30000);

    const netSum = balances.reduce((acc, b) => acc + b.netBalanceCents, 0);
    expect(netSum).toBe(0);
  });
});

describe("trip-math: calculateSimplifiedSettlements", () => {
  it("simplifica dívida direta entre devedor e credor", () => {
    const balances = [
      {
        memberId: "m1",
        name: "Gabriel",
        totalPaidCents: 60000,
        totalOwedCents: 30000,
        netBalanceCents: 30000,
      },
      {
        memberId: "m2",
        name: "Pedro",
        totalPaidCents: 30000,
        totalOwedCents: 30000,
        netBalanceCents: 0,
      },
      {
        memberId: "m3",
        name: "Tiago",
        totalPaidCents: 0,
        totalOwedCents: 30000,
        netBalanceCents: -30000,
      },
    ];

    const settlements = calculateSimplifiedSettlements(balances, [
      { id: "m1", name: "Gabriel", pix_key: "gabriel@axis.app", pix_key_type: "email" },
    ]);

    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      fromMemberId: "m3",
      fromMemberName: "Tiago",
      toMemberId: "m1",
      toMemberName: "Gabriel",
      toPixKey: "gabriel@axis.app",
      toPixKeyType: "email",
      amountCents: 30000,
    });
  });

  it("resolve rede circular de 4 amigos em número mínimo de transferências", () => {
    // 4 participantes: A deve 100, B deve 150, C recebe 200, D recebe 50
    const balances = [
      { memberId: "A", name: "A", totalPaidCents: 0, totalOwedCents: 100, netBalanceCents: -100 },
      { memberId: "B", name: "B", totalPaidCents: 0, totalOwedCents: 150, netBalanceCents: -150 },
      { memberId: "C", name: "C", totalPaidCents: 200, totalOwedCents: 0, netBalanceCents: 200 },
      { memberId: "D", name: "D", totalPaidCents: 50, totalOwedCents: 0, netBalanceCents: 50 },
    ];

    const settlements = calculateSimplifiedSettlements(balances);

    // Total devido: 250. Total a receber: 250.
    const totalTransferred = settlements.reduce((acc, s) => acc + s.amountCents, 0);
    expect(totalTransferred).toBe(250);

    // O número de liquidações deve ser estritamente <= N-1 (ou seja, <= 3)
    expect(settlements.length).toBeLessThanOrEqual(3);
  });
});

describe("trip-math: calculateLinkedExpenseWeight", () => {
  it("calcula a proporção decimal com 6 dígitos de precisão", () => {
    expect(calculateLinkedExpenseWeight(60000, 20000)).toBe(0.333333);
    expect(calculateLinkedExpenseWeight(40000, 10000)).toBe(0.25);
    expect(calculateLinkedExpenseWeight(10000, 10000)).toBe(1);
    expect(calculateLinkedExpenseWeight(0, 10000)).toBe(1);
  });
});
