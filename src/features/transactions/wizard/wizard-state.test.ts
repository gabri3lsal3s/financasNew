import { describe, expect, it } from "vitest";
import {
  buildExpenseInstallments,
  canProceed,
  CUSTOM_WEIGHT_VALUE,
  defaultLaunchState,
  effectiveReportWeight,
  isPresetWeight,
  reportWeightLabel,
  weightToPercentText,
} from "./wizard-state";

describe("buildExpenseInstallments (D12 — parcelas no cliente)", () => {
  it("gera parcelas com soma idêntica ao total", () => {
    const installments = buildExpenseInstallments({
      totalCents: 10000,
      count: 3,
      startDate: "2026-01-15",
    });
    expect(installments).toHaveLength(3);
    const sum = installments.reduce((acc, item) => acc + item.value, 0);
    expect(Math.round(sum * 100)).toBe(10000);
    expect(installments.map((item) => item.date)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
    expect(installments.every((item) => item.billCompetence === null)).toBe(true);
  });

  it("calcula competência de fatura por parcela quando cartão informa closing day", () => {
    const installments = buildExpenseInstallments({
      totalCents: 300000,
      count: 2,
      startDate: "2026-01-20",
      closingDay: 10,
    });
    // Compra 20/01 ≥ 10 → fatura fevereiro; parcela 2 (20/02 ≥ 10) → março.
    expect(installments[0]?.billCompetence).toBe("2026-02");
    expect(installments[1]?.billCompetence).toBe("2026-03");
  });
});

describe("canProceed — validação por passo", () => {
  it("passo 1 exige valor maior que zero", () => {
    const base = defaultLaunchState();
    expect(canProceed({ ...base, valueCents: 0 })).toBe(false);
    expect(canProceed({ ...base, valueCents: 100 })).toBe(true);
  });

  it("passo 2 exige categoria", () => {
    const base = { ...defaultLaunchState(), step: 2 };
    expect(canProceed({ ...base, categoryId: "" })).toBe(false);
    expect(canProceed({ ...base, categoryId: "c1" })).toBe(true);
  });

  it("passo 3 exige cartão no crédito e cobrança com valor", () => {
    const base = { ...defaultLaunchState(), step: 3, date: "2026-08-13" };
    expect(canProceed(base)).toBe(true);
    expect(canProceed({ ...base, paymentMethod: "credit_card", cardId: null })).toBe(false);
    expect(canProceed({ ...base, paymentMethod: "credit_card", cardId: "card-1" })).toBe(true);
    expect(canProceed({ ...base, debtEnabled: true, debtAmountCents: 0 })).toBe(false);
    expect(canProceed({ ...base, debtEnabled: true, debtAmountCents: 500 })).toBe(true);
  });

  it("passo 3 exige valor considerado válido no peso personalizado", () => {
    const base = {
      ...defaultLaunchState(),
      step: 3,
      valueCents: 10000,
      date: "2026-08-13",
      reportWeight: CUSTOM_WEIGHT_VALUE,
    };
    expect(canProceed({ ...base, reportCustomAmountCents: -100 })).toBe(false);
    expect(canProceed({ ...base, reportCustomAmountCents: 15000 })).toBe(false);
    expect(canProceed({ ...base, reportCustomAmountCents: 3750 })).toBe(true);
  });
});

describe("peso no relatório — presets e valor personalizado", () => {
  it("weightToPercentText formata fração em percentual pt-BR", () => {
    expect(weightToPercentText(0.375)).toBe("37,5");
    expect(weightToPercentText(1)).toBe("100");
  });

  it("isPresetWeight reconhece apenas os valores pré-definidos", () => {
    expect(isPresetWeight(1)).toBe(true);
    expect(isPresetWeight(0.75)).toBe(true);
    expect(isPresetWeight(0.5)).toBe(true);
    expect(isPresetWeight(0.25)).toBe(true);
    expect(isPresetWeight(0)).toBe(true);
    expect(isPresetWeight(0.375)).toBe(false);
    expect(isPresetWeight(CUSTOM_WEIGHT_VALUE)).toBe(false);
  });

  it("reportWeightLabel formata presets e valores personalizados com valor em reais", () => {
    expect(reportWeightLabel(1)).toBe("100% (conta integralmente)");
    expect(reportWeightLabel(0)).toBe("Não conta nos relatórios");
    expect(reportWeightLabel(0.5)).toBe("50%");
    expect(reportWeightLabel(0.375)).toBe("37,5%");
    expect(reportWeightLabel(0.375, 10000)).toContain("R$");
    expect(reportWeightLabel(0.375, 10000)).toContain("37,5% no relatório");
  });

  it("effectiveReportWeight usa o preset direto e calcula a fração do valor personalizado", () => {
    const base = defaultLaunchState();
    expect(effectiveReportWeight({ ...base, reportWeight: 0.5 })).toBe(0.5);
    expect(effectiveReportWeight({ ...base, reportWeight: 1 })).toBe(1);
    expect(
      effectiveReportWeight({
        ...base,
        valueCents: 10000,
        reportWeight: CUSTOM_WEIGHT_VALUE,
        reportCustomAmountCents: 3750,
      }),
    ).toBe(0.375);
    expect(
      effectiveReportWeight({
        ...base,
        valueCents: 10000,
        reportWeight: CUSTOM_WEIGHT_VALUE,
        reportCustomAmountCents: 10000,
      }),
    ).toBe(1);
  });
});
