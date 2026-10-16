import { describe, expect, it } from "vitest";
import {
  DEFAULT_BANK_ASSISTANT_PREFERENCES,
  HOMOLOGATED_BANKS,
  isBankMonitored,
  normalizeBankPreferences,
} from "./preferences";

describe("Domain — BankAssistantPreferences (Fase 14 — Tarefa 30)", () => {
  it("contém todos os 17 bancos homologados por padrão", () => {
    expect(HOMOLOGATED_BANKS.length).toBe(17);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.monitoredBanks.length).toBe(17);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.passiveCaptureEnabled).toBe(true);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.interactiveNotificationsEnabled).toBe(true);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.autoInstallmentsEnabled).toBe(true);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.autoCategoryInferenceEnabled).toBe(true);
  });

  it("normaliza payload bruto desconhecido aplicando os padrões de fábrica", () => {
    const normalized = normalizeBankPreferences(null);
    expect(normalized).toEqual(DEFAULT_BANK_ASSISTANT_PREFERENCES);

    const partial = normalizeBankPreferences({
      passiveCaptureEnabled: false,
      autoInstallmentsEnabled: false,
      monitoredBanks: ["Nubank", "Itaú", "BancoInvalido"],
    });

    expect(partial.passiveCaptureEnabled).toBe(false);
    expect(partial.interactiveNotificationsEnabled).toBe(true);
    expect(partial.autoInstallmentsEnabled).toBe(false);
    expect(partial.autoCategoryInferenceEnabled).toBe(true);
    expect(partial.monitoredBanks).toEqual(["Nubank", "Itaú"]);
  });

  it("verifica se um banco está monitorado respeitando a lista e o toggle mestre", () => {
    const prefs = {
      ...DEFAULT_BANK_ASSISTANT_PREFERENCES,
      monitoredBanks: ["Nubank", "Itaú"],
    };

    expect(isBankMonitored("Nubank", prefs)).toBe(true);
    expect(isBankMonitored("Itaú", prefs)).toBe(true);
    expect(isBankMonitored("Itaú Personnalité", prefs)).toBe(true);
    expect(isBankMonitored("Santander", prefs)).toBe(false);
    expect(isBankMonitored("Inter", prefs)).toBe(false);

    // Quando a captura passiva geral estiver desativada
    const disabledPrefs = {
      ...prefs,
      passiveCaptureEnabled: false,
    };
    expect(isBankMonitored("Nubank", disabledPrefs)).toBe(false);
    expect(isBankMonitored("Itaú", disabledPrefs)).toBe(false);
  });
});
