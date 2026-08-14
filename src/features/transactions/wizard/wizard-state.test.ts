import { describe, expect, it } from "vitest";
import {
  buildExpenseInstallments,
  canProceed,
  CUSTOM_WEIGHT_VALUE,
  defaultLaunchState,
  effectiveReportWeight,
  isPresetWeight,
  isValidPercent,
  parsePercentInput,
  percentToWeight,
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

  it("passo 3 exige percentual válido no peso personalizado", () => {
    const base = { ...defaultLaunchState(), step: 3, date: "2026-08-13", reportWeight: CUSTOM_WEIGHT_VALUE };
    expect(canProceed({ ...base, reportWeightCustom: "" })).toBe(false);
    expect(canProceed({ ...base, reportWeightCustom: "abc" })).toBe(false);
    expect(canProceed({ ...base, reportWeightCustom: "150" })).toBe(false);
    expect(canProceed({ ...base, reportWeightCustom: "37,5" })).toBe(true);
  });
});

describe("peso no relatório — presets e valor personalizado", () => {
  it("parsePercentInput aceita vírgula, ponto e sufixo %", () => {
    expect(parsePercentInput("37,5")).toBe(37.5);
    expect(parsePercentInput("37.5")).toBe(37.5);
    expect(parsePercentInput("37%")).toBe(37);
    expect(parsePercentInput(" 12 ")).toBe(12);
    expect(parsePercentInput("")).toBeNull();
    expect(parsePercentInput("abc")).toBeNull();
  });

  it("isValidPercent valida a faixa 0–100", () => {
    expect(isValidPercent(0)).toBe(true);
    expect(isValidPercent(100)).toBe(true);
    expect(isValidPercent(37.5)).toBe(true);
    expect(isValidPercent(-1)).toBe(false);
    expect(isValidPercent(101)).toBe(false);
    expect(isValidPercent(Number.NaN)).toBe(false);
  });

  it("converte percentual ↔ peso (0–100 ↔ 0–1)", () => {
    expect(percentToWeight(37.5)).toBe(0.375);
    expect(percentToWeight(100)).toBe(1);
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

  it("reportWeightLabel formata presets e valores personalizados", () => {
    expect(reportWeightLabel(1)).toBe("100% (conta integralmente)");
    expect(reportWeightLabel(0)).toBe("Não conta nos relatórios");
    expect(reportWeightLabel(0.5)).toBe("50%");
    expect(reportWeightLabel(0.375)).toBe("37,5%");
  });

  it("effectiveReportWeight usa o preset direto e resolve o personalizado", () => {
    const base = defaultLaunchState();
    expect(effectiveReportWeight({ ...base, reportWeight: 0.5 })).toBe(0.5);
    expect(effectiveReportWeight({ ...base, reportWeight: 1 })).toBe(1);
    expect(
      effectiveReportWeight({ ...base, reportWeight: CUSTOM_WEIGHT_VALUE, reportWeightCustom: "37,5" }),
    ).toBe(0.375);
    expect(effectiveReportWeight({ ...base, reportWeight: CUSTOM_WEIGHT_VALUE, reportWeightCustom: "100" })).toBe(1);
    // Fallback defensivo (canProceed já bloqueia texto inválido).
    expect(effectiveReportWeight({ ...base, reportWeight: CUSTOM_WEIGHT_VALUE, reportWeightCustom: "" })).toBe(0);
  });
});
