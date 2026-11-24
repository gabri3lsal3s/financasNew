import { describe, expect, it } from "vitest";
import {
  evaluateTransactionQuiz,
  INITIAL_TRANSACTION_QUIZ_ANSWERS,
} from "./transaction-playbook";

describe("evaluateTransactionQuiz", () => {
  it("recomenda credit_import quando o meio dominante é cartão de crédito", () => {
    const result = evaluateTransactionQuiz({
      frequency: "weekly",
      paymentMethod: "credit_card",
    });
    expect(result.kind).toBe("credit_import");
    expect(result.ctaType).toBe("import_statement");
    expect(result.title).toContain("Fatura");
  });

  it("recomenda pix_scanner quando o meio dominante é pix e débito", () => {
    const result = evaluateTransactionQuiz({
      frequency: "weekly",
      paymentMethod: "pix_debit",
    });
    expect(result.kind).toBe("pix_scanner");
    expect(result.ctaType).toBe("scan_pix");
    expect(result.title).toContain("Pix");
  });

  it("recomenda quick_manual quando a frequência é em tempo real com pagamentos mistos", () => {
    const result = evaluateTransactionQuiz({
      frequency: "realtime",
      paymentMethod: "mixed",
    });
    expect(result.kind).toBe("quick_manual");
    expect(result.ctaType).toBe("new_transaction");
  });

  it("recomenda hybrid para pagamentos mistos com frequência semanal ou mensal", () => {
    const result = evaluateTransactionQuiz({
      frequency: "monthly",
      paymentMethod: "mixed",
    });
    expect(result.kind).toBe("hybrid");
  });

  it("avalia corretamente as respostas padrão iniciais", () => {
    const result = evaluateTransactionQuiz(INITIAL_TRANSACTION_QUIZ_ANSWERS);
    expect(result.kind).toBe("credit_import");
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
