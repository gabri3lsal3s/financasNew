import { describe, expect, it } from "vitest";
import type { StatementTransaction } from "../types";
import {
  buildCandidateCuratorLines,
  curateLinesWithClientValidation,
} from "./line-curator";

describe("line-curator (Curador de Linhas por ID — Etapa 5)", () => {
  const tx1: StatementTransaction = {
    id: "tx-1",
    index: 0,
    occurrenceIndex: 0,
    statementHash: "hash-tx-1",
    date: "2026-08-10",
    cleanDescription: "Supermercado Pão de Açúcar",
    rawDescription: "PÃO DE AÇÚCAR SP",
    amountCents: 25000, // R$ 250,00
    isRefund: false,
    isPayment: false,
  };

  const tx2: StatementTransaction = {
    id: "tx-2",
    index: 1,
    occurrenceIndex: 1,
    statementHash: "hash-tx-2",
    date: "2026-08-12",
    cleanDescription: "Restaurante Fasano",
    rawDescription: "FASANO REST",
    amountCents: 15000, // R$ 150,00
    isRefund: false,
    isPayment: false,
  };

  const tx3SpuriousSubtotal: StatementTransaction = {
    id: "tx-3",
    index: 2,
    occurrenceIndex: 2,
    statementHash: "hash-tx-3",
    date: "2026-08-15",
    cleanDescription: "Total da Fatura Parcial",
    rawDescription: "SUBTOTAL FATURA R$ 400,00",
    amountCents: 40000, // R$ 400,00 (linha espúria de subtotal capturada)
    isRefund: false,
    isPayment: false,
  };

  const tx4Refund: StatementTransaction = {
    id: "tx-4",
    index: 3,
    occurrenceIndex: 3,
    statementHash: "hash-tx-4",
    date: "2026-08-16",
    cleanDescription: "Estorno Uber",
    rawDescription: "ESTORNO UBER",
    amountCents: 5000, // R$ 50,00 estorno
    isRefund: true,
    isPayment: false,
  };

  describe("buildCandidateCuratorLines", () => {
    it("converte transações em linhas indexadas estáveis com formatação clara para o LLM", () => {
      const candidates = buildCandidateCuratorLines([tx1, tx4Refund]);
      expect(candidates).toHaveLength(2);

      expect(candidates[0]?.id).toBe(0);
      expect(candidates[0]?.text).toContain("2026-08-10 Supermercado Pão de Açúcar R$ 250,00");

      expect(candidates[1]?.id).toBe(1);
      expect(candidates[1]?.text).toContain("2026-08-16 Estorno Uber R$ -50,00");
    });
  });

  describe("curateLinesWithClientValidation", () => {
    it("descarta IDs inexistentes/alucinados e deduplica IDs retornados", () => {
      const candidateLines = buildCandidateCuratorLines([tx1, tx2]);

      const result = curateLinesWithClientValidation({
        candidateLines,
        officialTotalCents: 40000,
        curatorOutput: {
          keep: [0, 0, 999], // 999 é alucinado, 0 é duplicado
          ignore: [1, 888], // 888 é alucinado
        },
      });

      // 999 e 888 foram descartados; 0 foi deduplicado
      expect(result.keptTransactions).toHaveLength(1);
      expect(result.keptTransactions[0]?.id).toBe("tx-1");

      expect(result.ignoredTransactions).toHaveLength(1);
      expect(result.ignoredTransactions[0]?.id).toBe("tx-2");
    });

    it("aplica fail-safe defensivo: preserva em keep qualquer linha que a IA esqueceu de classificar", () => {
      const candidateLines = buildCandidateCuratorLines([tx1, tx2, tx4Refund]);

      const result = curateLinesWithClientValidation({
        candidateLines,
        officialTotalCents: 35000,
        curatorOutput: {
          keep: [0], // esqueceu 1 e 2
          ignore: [],
        },
      });

      // IDs 1 e 2 foram mantidos no keep por segurança contábil
      expect(result.keptTransactions).toHaveLength(3);
    });

    it("recalcula Checksum Gate e aprova a soma ao ignorar linha espúria de subtotal", () => {
      // Total oficial esperado: tx1(250) + tx2(150) - tx4(50) = R$ 350,00 (35000 centavos)
      // O motor espacial havia extraído 350 + 400 = 750 (reprovado)
      const candidateLines = buildCandidateCuratorLines([tx1, tx2, tx3SpuriousSubtotal, tx4Refund]);

      const result = curateLinesWithClientValidation({
        candidateLines,
        officialTotalCents: 35000,
        curatorOutput: {
          keep: [0, 1, 3], // tx1, tx2, tx4 (estorno)
          ignore: [2], // tx3 (subtotal espúrio)
          reasons: {
            "2": "Subtotal de fatura e não compra real",
          },
        },
      });

      expect(result.wasCurated).toBe(true);
      expect(result.divergenceResolved).toBe(true);
      expect(result.checksumGate.passed).toBe(true);
      expect(result.checksumGate.extractedTotalCents).toBe(35000);
      expect(result.checksumGate.diffCents).toBe(0);
      expect(result.keptTransactions).toHaveLength(3);
      expect(result.ignoredTransactions).toHaveLength(1);
      expect(result.ignoredTransactions[0]?.id).toBe("tx-3");
    });

    it("sinaliza divergenceResolved=false e mantém dados de conferência caso a soma continue divergente", () => {
      const candidateLines = buildCandidateCuratorLines([tx1, tx2]);

      const result = curateLinesWithClientValidation({
        candidateLines,
        officialTotalCents: 90000, // Total oficial diferente
        curatorOutput: {
          keep: [0, 1],
          ignore: [],
        },
      });

      expect(result.wasCurated).toBe(true);
      expect(result.divergenceResolved).toBe(false);
      expect(result.checksumGate.passed).toBe(false);
      expect(result.checksumGate.diffCents).toBe(50000);
      expect(result.keptTransactions).toHaveLength(2);
    });
  });
});
