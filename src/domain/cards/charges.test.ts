import { describe, expect, it } from "vitest";
import { inferChargeKindFromDescription, summarizeInvoiceCharges } from "./charges";

describe("domain/cards/charges", () => {
  describe("summarizeInvoiceCharges", () => {
    it("retorna zeros e 0% para lista vazia sem divisão por zero", () => {
      const summary = summarizeInvoiceCharges([]);
      expect(summary).toEqual({
        consumptionCents: 0,
        interestCents: 0,
        fineCents: 0,
        taxCents: 0,
        bankFeeCents: 0,
        totalChargesCents: 0,
        totalInvoiceCents: 0,
        chargesPercentage: 0,
        hasCharges: false,
      });
    });

    it("calcula faturas com consumo puro (sem encargos)", () => {
      const expenses = [
        { value: 150.5, charge_kind: "regular" as const },
        { value: 49.5, charge_kind: undefined },
      ];
      const summary = summarizeInvoiceCharges(expenses);

      expect(summary.consumptionCents).toBe(20000);
      expect(summary.totalChargesCents).toBe(0);
      expect(summary.totalInvoiceCents).toBe(20000);
      expect(summary.chargesPercentage).toBe(0);
      expect(summary.hasCharges).toBe(false);
    });

    it("agrega encargos por categoria e calcula percentual sobre total", () => {
      const expenses = [
        { value: 400.0, charge_kind: "regular" as const },
        { value: 50.0, charge_kind: "interest" as const },
        { value: 20.0, charge_kind: "fine" as const },
        { value: 10.0, charge_kind: "tax" as const },
        { value: 20.0, charge_kind: "bank_fee" as const },
      ];
      const summary = summarizeInvoiceCharges(expenses);

      expect(summary.consumptionCents).toBe(40000);
      expect(summary.interestCents).toBe(5000);
      expect(summary.fineCents).toBe(2000);
      expect(summary.taxCents).toBe(1000);
      expect(summary.bankFeeCents).toBe(2000);
      expect(summary.totalChargesCents).toBe(10000);
      expect(summary.totalInvoiceCents).toBe(50000);
      expect(summary.chargesPercentage).toBe(20);
      expect(summary.hasCharges).toBe(true);
    });
  });

  describe("inferChargeKindFromDescription", () => {
    it("infere juros e refinanciamentos", () => {
      expect(inferChargeKindFromDescription("Juros de mora")).toBe("interest");
      expect(inferChargeKindFromDescription("JUROS ROTATIVO FURAO")).toBe("interest");
      expect(inferChargeKindFromDescription("Refinanciamento de fatura")).toBe("interest");
      expect(inferChargeKindFromDescription("Juros remuneratórios")).toBe("interest");
    });

    it("infere multas por atraso", () => {
      expect(inferChargeKindFromDescription("Multa por atraso")).toBe("fine");
      expect(inferChargeKindFromDescription("MULTA COMPENSATORIA")).toBe("fine");
      expect(inferChargeKindFromDescription("Encargo de mora")).toBe("fine");
    });

    it("infere IOF e tributos", () => {
      expect(inferChargeKindFromDescription("IOF DIARIO ROTATIVO")).toBe("tax");
      expect(inferChargeKindFromDescription("IOF Adicional")).toBe("tax");
      expect(inferChargeKindFromDescription("Tributo Federal IOF")).toBe("tax");
    });

    it("infere tarifas bancárias e anuidade", () => {
      expect(inferChargeKindFromDescription("Tarifa de anuidade diferenciada")).toBe("bank_fee");
      expect(inferChargeKindFromDescription("TARIFA BANCARIA SERV")).toBe("bank_fee");
      expect(inferChargeKindFromDescription("Taxa de emissao")).toBe("bank_fee");
    });

    it("retorna 'regular' para despesas normais de consumo ou vazias", () => {
      expect(inferChargeKindFromDescription("Supermercado Pao de Acucar")).toBe("regular");
      expect(inferChargeKindFromDescription("Uber *Trip 1234")).toBe("regular");
      expect(inferChargeKindFromDescription("Netflix.com")).toBe("regular");
      expect(inferChargeKindFromDescription("")).toBe("regular");
      expect(inferChargeKindFromDescription(null)).toBe("regular");
      expect(inferChargeKindFromDescription(undefined)).toBe("regular");
    });
  });
});
