import { describe, it, expect } from "vitest";
import {
  calculateEqualSplits,
  calculateMemberBalances,
  calculateSimplifiedSettlements,
  calculateLinkedExpenseWeight,
  getMemberExpenseStatement,
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

  it("recalcula cotas igualitárias dinamicamente quando um membro entra após despesa lançada (caso Você e Ítalo)", () => {
    // Cenário relatado pelo usuário:
    // 1. "Você" pagou R$ 50,00 quando ainda estava sozinho na viagem
    // 2. "Ítalo" entrou no grupo e pagou R$ 5,00
    const members = [
      { id: "m1", name: "Você" },
      { id: "m2", name: "Ítalo" },
    ];

    // Despesa 1: R$ 50,00 paga por Você (split_type: "equal", originalmente gravada com cota só para Você)
    // Despesa 2: R$ 5,00 paga por Ítalo (split_type: "equal")
    const expenses = [
      {
        paid_by_member_id: "m1",
        amount_cents: 5000,
        split_type: "equal" as const,
        splits: [{ member_id: "m1", share_cents: 5000 }],
      },
      {
        paid_by_member_id: "m2",
        amount_cents: 500,
        split_type: "equal" as const,
        splits: [
          { member_id: "m1", share_cents: 250 },
          { member_id: "m2", share_cents: 250 },
        ],
      },
    ];

    const balances = calculateMemberBalances(members, expenses);

    // Custo total da viagem = R$ 55,00 (5500 centavos)
    // Cota igualitária para cada um:
    // - Despesa 1 (5000): 2500 para Você, 2500 para Ítalo
    // - Despesa 2 (500): 250 para Você, 250 para Ítalo (com resto se houver)
    // Total devido por Você = 2750 centavos. Pagou 5000 -> Saldo: +2250 centavos (+ R$ 22,50)
    // Total devido por Ítalo = 2750 centavos. Pagou 500 -> Saldo: -2250 centavos (- R$ 22,50)
    const bVoce = balances.find((b) => b.memberId === "m1");
    const bItalo = balances.find((b) => b.memberId === "m2");

    expect(bVoce?.totalPaidCents).toBe(5000);
    expect(bVoce?.totalOwedCents).toBe(2750);
    expect(bVoce?.netBalanceCents).toBe(2250);

    expect(bItalo?.totalPaidCents).toBe(500);
    expect(bItalo?.totalOwedCents).toBe(2750);
    expect(bItalo?.netBalanceCents).toBe(-2250);

    // Na liquidação sugerida: Ítalo deve pagar R$ 22,50 para Você (e NÃO Você dever para Ítalo!)
    const settlements = calculateSimplifiedSettlements(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      fromMemberId: "m2",
      fromMemberName: "Ítalo",
      toMemberId: "m1",
      toMemberName: "Você",
      toPixKey: null,
      toPixKeyType: null,
      amountCents: 2250,
    });
  });

  it("respeita divisões customizadas (split_type: 'custom') informadas explicitamente", () => {
    const members = [
      { id: "m1", name: "Gabriel" },
      { id: "m2", name: "Pedro" },
      { id: "m3", name: "Tiago" },
    ];

    // Despesa customizada: Gabriel pagou R$ 60,00 apenas para Gabriel (R$ 40) e Pedro (R$ 20). Tiago não participou.
    const expenses = [
      {
        paid_by_member_id: "m1",
        amount_cents: 6000,
        split_type: "custom" as const,
        splits: [
          { member_id: "m1", share_cents: 4000 },
          { member_id: "m2", share_cents: 2000 },
        ],
      },
    ];

    const balances = calculateMemberBalances(members, expenses);
    const bTiago = balances.find((b) => b.memberId === "m3");
    const bPedro = balances.find((b) => b.memberId === "m2");
    const bGabriel = balances.find((b) => b.memberId === "m1");

    expect(bTiago?.totalOwedCents).toBe(0);
    expect(bPedro?.totalOwedCents).toBe(2000);
    expect(bGabriel?.totalOwedCents).toBe(4000);
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

  it("particiona grupos independentes gerando o número mínimo de transações (2 transferências em vez de 3)", () => {
    // 4 participantes particionáveis em 2 subconjuntos com soma zero:
    // Subconjunto 1: A (-50) e B (+50)
    // Subconjunto 2: C (-30) e D (+30)
    const balances = [
      { memberId: "A", name: "A", totalPaidCents: 0, totalOwedCents: 5000, netBalanceCents: -5000 },
      { memberId: "B", name: "B", totalPaidCents: 5000, totalOwedCents: 0, netBalanceCents: 5000 },
      { memberId: "C", name: "C", totalPaidCents: 0, totalOwedCents: 3000, netBalanceCents: -3000 },
      { memberId: "D", name: "D", totalPaidCents: 3000, totalOwedCents: 0, netBalanceCents: 3000 },
    ];

    const settlements = calculateSimplifiedSettlements(balances);

    // Deve gerar exatamente 2 transferências: A -> B (50) e C -> D (30)
    expect(settlements).toHaveLength(2);
    expect(settlements.some((s) => s.fromMemberId === "A" && s.toMemberId === "B" && s.amountCents === 5000)).toBe(true);
    expect(settlements.some((s) => s.fromMemberId === "C" && s.toMemberId === "D" && s.amountCents === 3000)).toBe(true);
  });

  it("liquida perfeitamente um grupo complexo de 10 participantes com soma zero", () => {
    // 10 participantes no Modo Viagem com saldos variados
    const balances = [
      { memberId: "m1", name: "P1", totalPaidCents: 10000, totalOwedCents: 5000, netBalanceCents: 5000 },
      { memberId: "m2", name: "P2", totalPaidCents: 0, totalOwedCents: 5000, netBalanceCents: -5000 },
      { memberId: "m3", name: "P3", totalPaidCents: 12000, totalOwedCents: 4000, netBalanceCents: 8000 },
      { memberId: "m4", name: "P4", totalPaidCents: 0, totalOwedCents: 4000, netBalanceCents: -4000 },
      { memberId: "m5", name: "P5", totalPaidCents: 0, totalOwedCents: 4000, netBalanceCents: -4000 },
      { memberId: "m6", name: "P6", totalPaidCents: 6000, totalOwedCents: 3000, netBalanceCents: 3000 },
      { memberId: "m7", name: "P7", totalPaidCents: 0, totalOwedCents: 3000, netBalanceCents: -3000 },
      { memberId: "m8", name: "P8", totalPaidCents: 15000, totalOwedCents: 5000, netBalanceCents: 10000 },
      { memberId: "m9", name: "P9", totalPaidCents: 0, totalOwedCents: 6000, netBalanceCents: -6000 },
      { memberId: "m10", name: "P10", totalPaidCents: 0, totalOwedCents: 4000, netBalanceCents: -4000 },
    ];

    // Soma dos saldos: +5000 -5000 +8000 -4000 -4000 +3000 -3000 +10000 -6000 -4000 = 0
    const sum = balances.reduce((acc, b) => acc + b.netBalanceCents, 0);
    expect(sum).toBe(0);

    const settlements = calculateSimplifiedSettlements(balances);

    // O total transferído deve cobrir exatamente o total positivo (26000 centavos)
    const totalTransferred = settlements.reduce((acc, s) => acc + s.amountCents, 0);
    expect(totalTransferred).toBe(26000);

    // Com 10 participantes particionáveis, o total de liquidações deve ser muito menor que 9
    expect(settlements.length).toBeLessThan(9);

    // Verifica que cada participante devedor pagou exatamente o que devia e cada credor recebeu o devido
    const paidByDebtor = new Map<string, number>();
    const receivedByCreditor = new Map<string, number>();

    for (const s of settlements) {
      paidByDebtor.set(s.fromMemberId, (paidByDebtor.get(s.fromMemberId) ?? 0) + s.amountCents);
      receivedByCreditor.set(s.toMemberId, (receivedByCreditor.get(s.toMemberId) ?? 0) + s.amountCents);
    }

    expect(paidByDebtor.get("m2")).toBe(5000);
    expect(paidByDebtor.get("m4")).toBe(4000);
    expect(paidByDebtor.get("m5")).toBe(4000);
    expect(paidByDebtor.get("m7")).toBe(3000);
    expect(paidByDebtor.get("m9")).toBe(6000);
    expect(paidByDebtor.get("m10")).toBe(4000);

    expect(receivedByCreditor.get("m1")).toBe(5000);
    expect(receivedByCreditor.get("m3")).toBe(8000);
    expect(receivedByCreditor.get("m6")).toBe(3000);
    expect(receivedByCreditor.get("m8")).toBe(10000);
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

describe("trip-math: joined_date e getMemberExpenseStatement (Explicabilidade)", () => {
  it("exclui membro de despesa anterior ao joined_date mas o inclui em despesas posteriores", () => {
    const members = [
      { id: "m1", name: "Gabriel", joined_date: null }, // desde o início
      { id: "m2", name: "Ítalo", joined_date: "2026-11-05" }, // chegou no dia 5
    ];

    const expenses = [
      // Dia 3: Gabriel pagou almoço R$ 60 (Ítalo ainda não havia chegado)
      {
        id: "e1",
        description: "Almoço Dia 3",
        paid_by_member_id: "m1",
        amount_cents: 6000,
        expense_date: "2026-11-03",
        split_type: "equal" as const,
      },
      // Dia 6: Gabriel pagou jantar R$ 100 (Ítalo já estava presente)
      {
        id: "e2",
        description: "Jantar Dia 6",
        paid_by_member_id: "m1",
        amount_cents: 10000,
        expense_date: "2026-11-06",
        split_type: "equal" as const,
      },
    ];

    const balances = calculateMemberBalances(members, expenses);
    const bGabriel = balances.find((b) => b.memberId === "m1");
    const bItalo = balances.find((b) => b.memberId === "m2");

    // Gabriel: pagou 16000 (6000 + 10000)
    // Devido Gabriel: 6000 (da despesa 1) + 5000 (da despesa 2) = 11000 -> Saldo: +5000
    // Devido Ítalo: 0 (da despesa 1) + 5000 (da despesa 2) = 5000 -> Saldo: -5000
    expect(bGabriel?.totalOwedCents).toBe(11000);
    expect(bGabriel?.netBalanceCents).toBe(5000);

    expect(bItalo?.totalOwedCents).toBe(5000);
    expect(bItalo?.netBalanceCents).toBe(-5000);

    // Agora gera o extrato detalhado para Ítalo
    const statement = getMemberExpenseStatement("m2", members, expenses);
    expect(statement.totalOwedCents).toBe(5000);
    expect(statement.participations).toHaveLength(1);
    expect(statement.participations[0]?.description).toBe("Jantar Dia 6");
    expect(statement.participations[0]?.userShareCents).toBe(5000);

    // Despesa do dia 3 deve estar na lista de exclusões com motivo claro
    expect(statement.exclusions).toHaveLength(1);
    expect(statement.exclusions[0]?.description).toBe("Almoço Dia 3");
    expect(statement.exclusions[0]?.reason).toBe("joined_after");
    expect(statement.exclusions[0]?.reasonText).toContain("antes da entrada de Ítalo no grupo");
  });
});
