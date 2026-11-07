import { describe, expect, it } from "vitest";
import { resolveIncomeCategory } from "./income-category-resolver";

describe("income-category-resolver — Motor Semântico de Categorização de Rendas (§Plano 09 — Tarefa 9.3)", () => {
  it("categoriza auto-depósito do Mercado Pago como transferencias_recebidas", () => {
    const res = resolveIncomeCategory(
      "Você depositou R$ 3.244,24 via Pix e o valor já está rendendo na sua conta.",
      "Seu dinheiro já está disponível",
    );
    expect(res.categorySlug).toBe("transferencias_recebidas");
    expect(res.isAutoDeposit).toBe(true);
  });

  it("categoriza adição de dinheiro no PicPay como transferencias_recebidas", () => {
    const res = resolveIncomeCategory(
      "Você adicionou R$ 500,00 via Pix à sua carteira.",
      "Dinheiro na conta!",
    );
    expect(res.categorySlug).toBe("transferencias_recebidas");
    expect(res.isAutoDeposit).toBe(true);
  });

  it("categoriza salário de empresa como salario", () => {
    const res = resolveIncomeCategory(
      "Crédito de salário no valor de R$ 4.500,00 da Empresa XPTO",
      "Itaú",
    );
    expect(res.categorySlug).toBe("salario");
    expect(res.isSalary).toBe(true);
  });

  it("categoriza proventos e dividendos como rendimentos", () => {
    const res = resolveIncomeCategory(
      "Crédito de proventos / dividendos no valor de R$ 120,50",
      "Banco do Brasil",
    );
    expect(res.categorySlug).toBe("rendimentos");
    expect(res.isInvestmentYield).toBe(true);
  });

  it("categoriza estorno e devolução como estorno/outros", () => {
    const res = resolveIncomeCategory(
      "Estorno no valor de R$ 45,00 efetuado com sucesso",
      "Nubank",
    );
    expect(res.isRefund).toBe(true);
  });
});
