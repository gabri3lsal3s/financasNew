import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import {
  resetSmartAdvisorCooldowns,
  useSmartAdvisorCooldownController,
} from "./use-smart-advisor-dismissals";

vi.mock("@/services/user-storage", () => ({
  getActiveUserId: () => "user-1",
  getUserStorageKey: (base: string, uid?: string | null) => `${base}:${uid ?? "anon"}`,
  subscribeActiveUserId: () => () => {},
}));

vi.mock("@/state", () => ({
  useUserPreferences: () => ({ data: null }),
  useUpdateCustomSettings: () => ({ mutate: vi.fn() }),
}));

const insightA: SmartAdvisorInsight = {
  id: "habit:cafe",
  themeKey: "habit:cafe",
  priority: 3,
  category: "savings",
  title: "Café frequente",
  description: "Você gastou R$ 120,00.",
  iconName: "trending-down",
};

const insightB: SmartAdvisorInsight = {
  id: "habit:lanche",
  themeKey: "habit:lanche",
  priority: 3,
  category: "savings",
  title: "Lanche frequente",
  description: "Você gastou R$ 90,00.",
  iconName: "trending-down",
};

describe("useSmartAdvisorCooldownController", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSmartAdvisorCooldowns();
  });

  it("simples adiamento registra apenas advisorDismissals sem elevar decay/mute de família", () => {
    const onPersistCloudDismissal = vi.fn();
    const { result } = renderHook(() =>
      useSmartAdvisorCooldownController({
        todayISOStr: "2026-11-27",
        nowMs: new Date(2026, 10, 27, 10, 0).getTime(),
        onPersistCloudDismissal,
      }),
    );

    act(() => {
      result.current.dismissInsight([insightA, insightB], "habit:cafe", "habit:cafe", 7);
    });

    expect(onPersistCloudDismissal).toHaveBeenCalledTimes(1);
    const payload = onPersistCloudDismissal.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("advisorDecayMeta");
    expect(result.current.effectiveDecayMeta).toEqual({});

    // Mute explícito continua funcionando via muteFamily
    act(() => {
      result.current.muteFamily("habit:cafe");
    });

    expect(result.current.effectiveDecayMeta.habit?.muted).toBe(true);
  });
});
