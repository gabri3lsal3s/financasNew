import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BANK_ASSISTANT_PREFERENCES } from "@/domain/notifications";
import {
  getBankAssistantPreferences,
  resetBankAssistantPreferences,
  setBankAssistantPreferences,
  subscribeBankAssistantPreferences,
  useBankAssistantPreferences,
} from "./bank-assistant-preferences";

describe("Native Service — BankAssistantPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    resetBankAssistantPreferences();
  });

  it("retorna as preferências padrão quando o storage está vazio", () => {
    const prefs = getBankAssistantPreferences();
    expect(prefs).toEqual(DEFAULT_BANK_ASSISTANT_PREFERENCES);
  });

  it("permite atualizar campos individuais preservando os demais", () => {
    const updated = setBankAssistantPreferences({
      passiveCaptureEnabled: false,
      monitoredBanks: ["Nubank", "Itaú"],
    });

    expect(updated.passiveCaptureEnabled).toBe(false);
    expect(updated.interactiveNotificationsEnabled).toBe(true);
    expect(updated.autoInstallmentsEnabled).toBe(true);
    expect(updated.monitoredBanks).toEqual(["Nubank", "Itaú"]);

    const persisted = getBankAssistantPreferences();
    expect(persisted).toEqual(updated);
  });

  it("notifica inscritos quando as preferências mudam", () => {
    const events: unknown[] = [];
    const unsubscribe = subscribeBankAssistantPreferences((p) => {
      events.push(p);
    });

    setBankAssistantPreferences({ autoCategoryInferenceEnabled: false });

    expect(events.length).toBe(1);
    expect((events[0] as { autoCategoryInferenceEnabled: boolean }).autoCategoryInferenceEnabled).toBe(
      false,
    );

    unsubscribe();
    setBankAssistantPreferences({ autoCategoryInferenceEnabled: true });
    expect(events.length).toBe(1);
  });

  it("integra de forma reativa com o hook useBankAssistantPreferences", () => {
    const { result } = renderHook(() => useBankAssistantPreferences());

    expect(result.current.preferences.passiveCaptureEnabled).toBe(true);

    act(() => {
      result.current.updatePreferences({ passiveCaptureEnabled: false });
    });

    expect(result.current.preferences.passiveCaptureEnabled).toBe(false);

    act(() => {
      result.current.resetPreferences();
    });

    expect(result.current.preferences.passiveCaptureEnabled).toBe(true);
  });
});
