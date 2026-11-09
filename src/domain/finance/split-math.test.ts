import { describe, expect, it } from "vitest";
import {
  buildSplitParticipantInstallments,
  calculateGuestAmountCents,
  calculateInstallmentsProgress,
  calculateSplitSummary,
  DEFAULT_SPLIT_REMAINDER_POLICY,
  MAX_SPLIT_PARTICIPANTS,
  splitAmountEqually,
  splitCustomWithRemainder,
  sumSplitCents,
  validateSplitInputs,
} from "./split-math";

describe("split-math (Algoritmo Puro de Rateio de Centavos)", () => {
  describe("splitAmountEqually - Divisao Exata e Politicas de Resto", () => {
    it("divide perfeitamente sem resto euclidiano", () => {
      // R$ 90,00 entre 3 pessoas = R$ 30,00 cada
      const result = splitAmountEqually(9000, 3);
      expect(result).toEqual([3000, 3000, 3000]);
      expect(sumSplitCents(result)).toBe(9000);
    });

    it("distribui o resto balanceadamente centavo a centavo (politica 'balanced')", () => {
      // R$ 100,00 (10000 centavos) entre 3 pessoas:
      // base = 3333, resto = 1
      // participante 0 (anfitriao) recebe 3334, participantes 1 e 2 recebem 3333
      const result = splitAmountEqually(10000, 3, { remainderPolicy: "balanced" });
      expect(result).toEqual([3334, 3333, 3333]);
      expect(sumSplitCents(result)).toBe(10000);
    });

    it("adota 'balanced' como politica padrao quando nao informada", () => {
      expect(DEFAULT_SPLIT_REMAINDER_POLICY).toBe("balanced");
      const withDefault = splitAmountEqually(10000, 3);
      const explicit = splitAmountEqually(10000, 3, { remainderPolicy: "balanced" });
      expect(withDefault).toEqual(explicit);
    });

    it("distribui resto entre múltiplos participantes sem ultrapassar 1 centavo de diferenca", () => {
      // R$ 100,00 (10000 centavos) entre 6 pessoas:
      // base = 1666, resto = 4
      // 4 primeiros recebem 1667, 2 ultimos recebem 1666
      const result = splitAmountEqually(10000, 6, { remainderPolicy: "balanced" });
      expect(result).toEqual([1667, 1667, 1667, 1667, 1666, 1666]);
      expect(sumSplitCents(result)).toBe(10000);

      const max = Math.max(...result);
      const min = Math.min(...result);
      expect(max - min).toBeLessThanOrEqual(1);
    });

    it("atribui toda a sobra ao anfitriao na politica 'host' para manter convidados uniformes", () => {
      // R$ 100,00 (10000 centavos) entre 6 pessoas:
      // base = 1666, resto = 4
      // Anfitriao (indice 0) recebe 1666 + 4 = 1670
      // Todos os 5 convidados recebem exatamente 1666
      const result = splitAmountEqually(10000, 6, { remainderPolicy: "host" });
      expect(result).toEqual([1670, 1666, 1666, 1666, 1666, 1666]);
      expect(sumSplitCents(result)).toBe(10000);

      // Garante que convidados pagam rigorosamente o mesmo valor
      const guestShares = result.slice(1);
      expect(new Set(guestShares).size).toBe(1);
      expect(guestShares[0]).toBe(1666);
    });

    it("atribui resto unico ao anfitriao na politica 'host'", () => {
      // R$ 100,00 entre 3 pessoas na politica 'host'
      const result = splitAmountEqually(10000, 3, { remainderPolicy: "host" });
      expect(result).toEqual([3334, 3333, 3333]);
      expect(sumSplitCents(result)).toBe(10000);
    });
  });

  describe("Casos de Borda (Edge Cases)", () => {
    it("retorna array com zeros quando o total for 0 centavos", () => {
      const result = splitAmountEqually(0, 4);
      expect(result).toEqual([0, 0, 0, 0]);
      expect(sumSplitCents(result)).toBe(0);
    });

    it("retorna o valor integral quando houver apenas 1 participante", () => {
      const result = splitAmountEqually(15050, 1);
      expect(result).toEqual([15050]);
      expect(sumSplitCents(result)).toBe(15050);
    });

    it("gerencia rateio de centavos menores que a quantidade de pessoas (politica balanced)", () => {
      // 2 centavos entre 5 pessoas
      const result = splitAmountEqually(2, 5, { remainderPolicy: "balanced" });
      expect(result).toEqual([1, 1, 0, 0, 0]);
      expect(sumSplitCents(result)).toBe(2);
    });

    it("gerencia rateio de centavos menores que a quantidade de pessoas (politica host)", () => {
      // 2 centavos entre 5 pessoas
      const result = splitAmountEqually(2, 5, { remainderPolicy: "host" });
      expect(result).toEqual([2, 0, 0, 0, 0]);
      expect(sumSplitCents(result)).toBe(2);
    });

    it("mantem precisao em valores elevados sem estouro de precisao", () => {
      // R$ 500.000,00 (50.000.000 centavos) entre 7 pessoas
      const total = 50_000_000;
      const result = splitAmountEqually(total, 7);
      expect(result.length).toBe(7);
      expect(sumSplitCents(result)).toBe(total);
    });
  });

  describe("Invariantes de Conservacao (Property-Based / Fuzzing)", () => {
    it("preserva rigorosamente a soma exata em centenas de combinacoes aleatorias", () => {
      const testCases = [
        { total: 1, people: 2 },
        { total: 10, people: 3 },
        { total: 99, people: 7 },
        { total: 100, people: 3 },
        { total: 101, people: 4 },
        { total: 1000, people: 11 },
        { total: 123456, people: 13 },
        { total: 9876543, people: 29 },
        { total: 45000000, people: 47 },
      ];

      for (const tc of testCases) {
        const balanced = splitAmountEqually(tc.total, tc.people, { remainderPolicy: "balanced" });
        expect(sumSplitCents(balanced)).toBe(tc.total);
        expect(balanced.every((share) => Number.isInteger(share) && share >= 0)).toBe(true);

        const host = splitAmountEqually(tc.total, tc.people, { remainderPolicy: "host" });
        expect(sumSplitCents(host)).toBe(tc.total);
        expect(host.every((share) => Number.isInteger(share) && share >= 0)).toBe(true);
      }
    });

    it("assegura que nenhuma fatia varie em mais de 1 centavo no modo 'balanced'", () => {
      for (let people = 2; people <= 20; people++) {
        for (let total = 1; total <= 50; total++) {
          const shares = splitAmountEqually(total, people, { remainderPolicy: "balanced" });
          const diff = Math.max(...shares) - Math.min(...shares);
          expect(diff).toBeLessThanOrEqual(1);
          expect(sumSplitCents(shares)).toBe(total);
        }
      }
    });

    it("assegura que todos os convidados paguem identico valor no modo 'host'", () => {
      for (let people = 2; people <= 15; people++) {
        for (let total = 10; total <= 100; total += 7) {
          const shares = splitAmountEqually(total, people, { remainderPolicy: "host" });
          const guests = shares.slice(1);
          const uniqueGuestValues = new Set(guests);
          expect(uniqueGuestValues.size).toBe(1);
          expect(sumSplitCents(shares)).toBe(total);
        }
      }
    });
  });

  describe("Validacoes e Tratamento de Erros", () => {
    it("lanca erro se total for negativo", () => {
      expect(() => splitAmountEqually(-100, 2)).toThrow("Total em centavos deve ser um inteiro");
    });

    it("lanca erro se total nao for numero inteiro", () => {
      expect(() => splitAmountEqually(100.5, 2)).toThrow("Total em centavos deve ser um inteiro");
    });

    it("lanca erro se total for NaN ou Infinity", () => {
      expect(() => splitAmountEqually(NaN, 2)).toThrow("Total em centavos deve ser um inteiro");
      expect(() => splitAmountEqually(Infinity, 2)).toThrow("Total em centavos deve ser um inteiro");
    });

    it("lanca erro se total exceder o limite seguro maximo", () => {
      expect(() => splitAmountEqually(999_999_999_999, 2)).toThrow("excede o limite maximo");
    });

    it("lanca erro se numero de pessoas for menor que 1", () => {
      expect(() => splitAmountEqually(1000, 0)).toThrow("Numero de participantes deve ser um inteiro");
      expect(() => splitAmountEqually(1000, -2)).toThrow("Numero de participantes deve ser um inteiro");
    });

    it("lanca erro se numero de pessoas for fracionado", () => {
      expect(() => splitAmountEqually(1000, 2.5)).toThrow("Numero de participantes deve ser um inteiro");
    });

    it("lanca erro se numero de pessoas exceder o limite defensivo", () => {
      expect(() => splitAmountEqually(1000, MAX_SPLIT_PARTICIPANTS + 1)).toThrow(
        "excede o limite maximo",
      );
    });

    it("validateSplitInputs passa sem excecao para parametros legitimos", () => {
      expect(() => validateSplitInputs(10000, 4)).not.toThrow();
    });
  });

  describe("calculateSplitSummary", () => {
    it("monta o resumo completo com metadados confiaveis", () => {
      const summary = calculateSplitSummary(10000, 3, { remainderPolicy: "host" });

      expect(summary.totalCents).toBe(10000);
      expect(summary.peopleCount).toBe(3);
      expect(summary.guestCount).toBe(2);
      expect(summary.hostShareCents).toBe(3334);
      expect(summary.guestShareCents).toBe(3333);
      expect(summary.shares).toEqual([3334, 3333, 3333]);
      expect(summary.remainderCents).toBe(1);
      expect(summary.remainderPolicy).toBe("host");
      expect(summary.sumCents).toBe(10000);
    });

    it("monta o resumo para participante unico sem convidados", () => {
      const summary = calculateSplitSummary(5000, 1);

      expect(summary.totalCents).toBe(5000);
      expect(summary.peopleCount).toBe(1);
      expect(summary.guestCount).toBe(0);
      expect(summary.hostShareCents).toBe(5000);
      expect(summary.guestShareCents).toBe(0);
      expect(summary.shares).toEqual([5000]);
      expect(summary.remainderCents).toBe(0);
    });
  });

  describe("calculateGuestAmountCents", () => {
    it("calcula fatia de cada convidado em modo host", () => {
      expect(calculateGuestAmountCents(10000, 3, "host")).toBe(3333);
      expect(calculateGuestAmountCents(10000, 4, "host")).toBe(2500);
      expect(calculateGuestAmountCents(10000, 6, "host")).toBe(1666);
    });

    it("retorna 0 para participantes <= 1 ou total <= 0", () => {
      expect(calculateGuestAmountCents(10000, 1)).toBe(0);
      expect(calculateGuestAmountCents(0, 3)).toBe(0);
    });
  });

  describe("splitCustomWithRemainder", () => {
    it("divide proporcionalmente por pesos relativos mantendo a soma exata", () => {
      const participants = [
        { name: "Anfitriao", isHost: true, weight: 2 },
        { name: "Amigo 1", isHost: false, weight: 1 },
        { name: "Amigo 2", isHost: false, weight: 1 },
      ];

      // Total R$ 100,00 (10000 centavos), proporcao 2:1:1 (50% : 25% : 25%)
      const result = splitCustomWithRemainder(10000, participants);

      expect(result[0]?.shareCents).toBe(5000);
      expect(result[1]?.shareCents).toBe(2500);
      expect(result[2]?.shareCents).toBe(2500);
      expect(sumSplitCents(result.map((r) => r.shareCents))).toBe(10000);
    });

    it("resolve resto por maiores fracoes decimais (Hare-Niemeyer)", () => {
      const participants = [
        { name: "P1", weight: 1 },
        { name: "P2", weight: 1 },
        { name: "P3", weight: 1 },
      ];

      const result = splitCustomWithRemainder(10000, participants);
      expect(sumSplitCents(result.map((r) => r.shareCents))).toBe(10000);
      expect(result.map((r) => r.shareCents)).toEqual([3334, 3333, 3333]);
    });

    it("suporta fatias com valor fixo manual e distribui o restante pelos pesos", () => {
      const participants = [
        { name: "Anfitriao", isHost: true, fixedCents: 4000 }, // R$ 40,00 fixo
        { name: "Amigo 1", weight: 1 },
        { name: "Amigo 2", weight: 1 },
      ];

      // Total R$ 100,00. Sobram R$ 60,00 divididos igualmente entre os 2 amigos
      const result = splitCustomWithRemainder(10000, participants);

      expect(result[0]?.shareCents).toBe(4000);
      expect(result[1]?.shareCents).toBe(3000);
      expect(result[2]?.shareCents).toBe(3000);
      expect(sumSplitCents(result.map((r) => r.shareCents))).toBe(10000);
    });

    it("lanca erro se soma dos valores fixos exceder o total", () => {
      const participants = [
        { name: "P1", fixedCents: 6000 },
        { name: "P2", fixedCents: 5000 },
      ];

      expect(() => splitCustomWithRemainder(10000, participants)).toThrow(
        "Soma dos valores fixos excede o total",
      );
    });

    it("lanca erro para lista vazia de participantes", () => {
      expect(() => splitCustomWithRemainder(10000, [])).toThrow(
        "Lista de participantes deve conter pelo menos 1",
      );
    });
  });

  describe("buildSplitParticipantInstallments e calculateInstallmentsProgress", () => {
    it("divide o valor do participante conservando rigorosamente a soma dos centavos", () => {
      // Participante deve R$ 100,00 (10000 centavos) em 3 parcelas
      const installments = buildSplitParticipantInstallments({
        participantId: "p_2",
        totalShareCents: 10000,
        installmentsCount: 3,
        startDate: "2026-03-15",
      });

      expect(installments).toHaveLength(3);
      expect(installments[0]?.amount_cents).toBe(3334);
      expect(installments[1]?.amount_cents).toBe(3333);
      expect(installments[2]?.amount_cents).toBe(3333);
      expect(installments.reduce((acc, i) => acc + i.amount_cents, 0)).toBe(10000);

      expect(installments[0]?.due_date).toBe("2026-03-15");
      expect(installments[1]?.due_date).toBe("2026-04-15");
      expect(installments[2]?.due_date).toBe("2026-05-15");
    });

    it("retorna 1 parcela única se count <= 1", () => {
      const installments = buildSplitParticipantInstallments({
        participantId: "p_2",
        totalShareCents: 5000,
        installmentsCount: 1,
        startDate: "2026-03-15",
      });

      expect(installments).toHaveLength(1);
      expect(installments[0]?.amount_cents).toBe(5000);
      expect(installments[0]?.installment_number).toBe(1);
      expect(installments[0]?.total_installments).toBe(1);
    });

    it("calcula o progresso de pagamento das parcelas de forma precisa", () => {
      const installments = buildSplitParticipantInstallments({
        participantId: "p_2",
        totalShareCents: 15000,
        installmentsCount: 3,
        startDate: "2026-03-15",
      });

      // Inicial: 3 pendentes
      const progress1 = calculateInstallmentsProgress(installments);
      expect(progress1.totalCount).toBe(3);
      expect(progress1.settledCount).toBe(0);
      expect(progress1.pendingCount).toBe(3);
      expect(progress1.totalCents).toBe(15000);
      expect(progress1.settledCents).toBe(0);
      expect(progress1.remainingCents).toBe(15000);
      expect(progress1.nextPendingInstallment?.installment_number).toBe(1);

      // Marca a primeira como quitada
      const updated = [
        { ...installments[0]!, is_settled: true, settled_at: "2026-03-16T10:00:00Z" },
        installments[1]!,
        installments[2]!,
      ];

      const progress2 = calculateInstallmentsProgress(updated);
      expect(progress2.settledCount).toBe(1);
      expect(progress2.pendingCount).toBe(2);
      expect(progress2.settledCents).toBe(5000);
      expect(progress2.remainingCents).toBe(10000);
      expect(progress2.nextPendingInstallment?.installment_number).toBe(2);
    });
  });
});
