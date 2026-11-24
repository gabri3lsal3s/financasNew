import { describe, expect, it } from "vitest";
import { calculateTaxShield, inferBusinessTaxDeductibility } from "./tax-shield";

describe("tax-shield (Escudo Tributário Líquido)", () => {
  it("não permite que IOF de cartão abata a provisão tributária e soma despesas dedutíveis", () => {
    const shield = calculateTaxShield({
      profileKind: "mei",
      grossRevenueCents: 600_000,
      monthlyDasCents: 7_590,
      expenses: [
        // IOF no cartão (NÃO deve abater provisão)
        {
          value: 50,
          scope: "business",
          is_internal_transfer: false,
          charge_kind: "tax",
          payment_method: "credit_card",
          card_id: "c1",
          is_tax_deductible: false,
        },
        // Despesa dedutível operacional (ex: consultório)
        {
          value: 400,
          scope: "business",
          is_internal_transfer: false,
          charge_kind: "regular",
          payment_method: "pix",
          is_tax_deductible: true,
        },
      ],
    });

    expect(shield.estimatedTaxCents).toBe(7_590);
    expect(shield.paidFiscalTaxesCents).toBe(0);
    expect(shield.netProvisionRemainingCents).toBe(7_590);
    expect(shield.isFullyCovered).toBe(false);
    expect(shield.deductibleExpensesCents).toBe(40_000);
  });

  it("zera provisão restante quando guia DAS / imposto fiscal sem cartão é pago", () => {
    const shield = calculateTaxShield({
      profileKind: "liberal",
      grossRevenueCents: 1_000_000,
      taxProvisionRatePct: 10,
      expenses: [
        {
          value: 1000,
          scope: "business",
          is_internal_transfer: false,
          charge_kind: "tax",
          payment_method: "pix",
          card_id: null,
        },
      ],
    });

    expect(shield.estimatedTaxCents).toBe(100_000);
    expect(shield.paidFiscalTaxesCents).toBe(100_000);
    expect(shield.netProvisionRemainingCents).toBe(0);
    expect(shield.coveragePct).toBe(100);
    expect(shield.isFullyCovered).toBe(true);
  });

  describe("inferBusinessTaxDeductibility", () => {
    it("identifica softwares de trabalho, nuvem e SaaS como despesas dedutíveis", () => {
      const aws = inferBusinessTaxDeductibility({ description: "AWS Cloud Services", categoryName: "Tecnologia" });
      expect(aws.isDeductible).toBe(true);
      expect(aws.confidence).toBe("high");

      const figma = inferBusinessTaxDeductibility({ description: "Figma Professional Monthly" });
      expect(figma.isDeductible).toBe(true);

      const cert = inferBusinessTaxDeductibility({ description: "Emissão Certificado Digital A1 Serasa" });
      expect(cert.isDeductible).toBe(true);
    });

    it("identifica honorários contábeis, papelaria e coworking como dedutíveis", () => {
      const contab = inferBusinessTaxDeductibility({ description: "Honorários Contabilidade Mensal" });
      expect(contab.isDeductible).toBe(true);

      const papelaria = inferBusinessTaxDeductibility({ description: "Papel A4 e toner para escritório" });
      expect(papelaria.isDeductible).toBe(true);

      const coworking = inferBusinessTaxDeductibility({ description: "Mensalidade Coworking Sala Privativa" });
      expect(coworking.isDeductible).toBe(true);
    });

    it("rejeita gastos domésticos e familiares mesmo se lançados no contexto de negócio", () => {
      const mercado = inferBusinessTaxDeductibility({ description: "Supermercado Pão de Açúcar", categoryName: "Geral" });
      expect(mercado.isDeductible).toBe(false);
      expect(mercado.confidence).toBe("high");

      const cinema = inferBusinessTaxDeductibility({ description: "Cinemark Shopping Iguatemi" });
      expect(cinema.isDeductible).toBe(false);

      const netflix = inferBusinessTaxDeductibility({ description: "Netflix Assinatura Familiar" });
      expect(netflix.isDeductible).toBe(false);
    });

    it("retorna low confidence para descrições vazias ou genéricas sem palavras-chave", () => {
      const empty = inferBusinessTaxDeductibility({});
      expect(empty.isDeductible).toBe(false);
      expect(empty.confidence).toBe("low");

      const generic = inferBusinessTaxDeductibility({ description: "Pagamento diversos fornecedor" });
      expect(generic.isDeductible).toBe(false);
      expect(generic.confidence).toBe("low");
    });
  });
});

