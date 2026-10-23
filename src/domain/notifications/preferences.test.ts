import { describe, expect, it } from "vitest";
import {
  DEFAULT_BANK_ASSISTANT_PREFERENCES,
  HOMOLOGATED_BANKS,
  HOMOLOGATED_INSTITUTIONS,
  getInstitutionById,
  getInstitutionsByCategory,
  getPackagesForMonitoredBanks,
  isBankMonitored,
  normalizeBankPreferences,
} from "./preferences";

describe("Domain — BankAssistantPreferences (Fase 1 — Tarefa 1.4)", () => {
  it("contém catálogo homologado categorizado com 27 instituições", () => {
    expect(HOMOLOGATED_INSTITUTIONS.length).toBe(27);
    expect(HOMOLOGATED_BANKS.length).toBe(27);

    const traditionalDigital = getInstitutionsByCategory("traditional_digital");
    const paymentWallets = getInstitutionsByCategory("payment_wallets");
    const investmentsCrypto = getInstitutionsByCategory("investments_crypto");

    expect(traditionalDigital.length).toBe(14);
    expect(paymentWallets.length).toBe(7);
    expect(investmentsCrypto.length).toBe(6);
    expect(traditionalDigital.length + paymentWallets.length + investmentsCrypto.length).toBe(27);
  });

  it("garante integridade de cada instituição homologada", () => {
    for (const inst of HOMOLOGATED_INSTITUTIONS) {
      expect(inst.id).toBeTruthy();
      expect(inst.name).toBeTruthy();
      expect(inst.packages.length).toBeGreaterThan(0);
      expect(["traditional_digital", "payment_wallets", "investments_crypto"]).toContain(
        inst.category,
      );
      expect(typeof inst.supportsCardPurchases).toBe("boolean");
      expect(typeof inst.supportsInvestments).toBe("boolean");
    }
  });

  it("inicia lista de bancos monitorados vazia por padrão para novas instalações", () => {
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.monitoredBanks).toEqual([]);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.passiveCaptureEnabled).toBe(true);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.interactiveNotificationsEnabled).toBe(true);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.autoInstallmentsEnabled).toBe(true);
    expect(DEFAULT_BANK_ASSISTANT_PREFERENCES.autoCategoryInferenceEnabled).toBe(true);
  });

  it("busca instituição por ID único", () => {
    const nubank = getInstitutionById("nubank");
    expect(nubank?.name).toBe("Nubank");
    expect(nubank?.packages).toContain("com.nu.production");

    const googleWallet = getInstitutionById("google-wallet");
    expect(googleWallet?.name).toBe("Carteira Google");
    expect(googleWallet?.category).toBe("payment_wallets");

    const rico = getInstitutionById("rico");
    expect(rico?.name).toBe("Rico");
    expect(rico?.category).toBe("investments_crypto");

    expect(getInstitutionById("inexistente")).toBeUndefined();
  });

  it("retorna pacotes associados aos bancos monitorados", () => {
    const pkgs = getPackagesForMonitoredBanks(["Nubank", "Carteira Google", "Rico"]);
    expect(pkgs).toContain("com.nu.production");
    expect(pkgs).toContain("com.google.android.apps.walletnfcrel");
    expect(pkgs).toContain("br.com.rico");
    expect(pkgs).toContain("br.com.rico.investimentos");
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
      monitoredBanks: ["Nubank", "Itaú", "Carteira Google", "Rico"],
    };

    expect(isBankMonitored("Nubank", prefs)).toBe(true);
    expect(isBankMonitored("Itaú", prefs)).toBe(true);
    expect(isBankMonitored("Itaú Personnalité", prefs)).toBe(true);
    expect(isBankMonitored("Carteira Google", prefs)).toBe(true);
    expect(isBankMonitored("Rico", prefs)).toBe(true);
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

  it("mapeia pacotes canônicos da Play Store e legados para Rico, BTG, XP e Nomad (Fase 11 / Tarefa 11.1)", () => {
    const pkgs = getPackagesForMonitoredBanks(["Rico", "BTG Investimentos", "XP Investimentos", "Nomad"]);
    // Rico
    expect(pkgs).toContain("br.com.rico.rico");
    expect(pkgs).toContain("br.com.rico");
    expect(pkgs).toContain("br.com.rico.investimentos");

    // BTG Investimentos
    expect(pkgs).toContain("br.com.btg.pactual.digital");
    expect(pkgs).toContain("com.btgpactual.investimentos");

    // XP Investimentos
    expect(pkgs).toContain("br.com.xp.investimentos");
    expect(pkgs).toContain("br.com.xp.carteira");
    expect(pkgs).toContain("com.xpinc.investments");

    // Nomad
    expect(pkgs).toContain("com.nomadglobal.app");
    expect(pkgs).toContain("com.nomadfinancial.app");
  });
});
