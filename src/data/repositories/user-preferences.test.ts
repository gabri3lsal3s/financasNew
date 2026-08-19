import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getUserPreferences,
  updateSectorCaps,
  updateReminderPreferences,
  updateCustomSettings,
} from "./user-preferences";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastError: unknown = null;
let lastUpdateInput: unknown = null;

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.update.mockImplementation((input: unknown) => {
    lastUpdateInput = input;
    return {
      eq: vi.fn().mockReturnValue({
        then: (cb: (v: unknown) => unknown) => Promise.resolve({ error: lastError }).then(cb),
      }),
    };
  });
  builder.maybeSingle.mockReturnValue({
    then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb),
  });
  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({ from: () => builder }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: async () => "u1",
}));

describe("user-preferences repository", () => {
  beforeEach(() => {
    lastError = null;
    lastUpdateInput = null;
  });

  it("getUserPreferences devolve dados mapeados", async () => {
    builder = makeBuilder({
      data: {
        user_id: "u1",
        theme: "system",
        reminders_enabled: true,
        reminder_days_before_debt: 3,
        reminder_days_before_bill: 5,
        report_weights_enabled: false,
        max_sector_acoes: "25",
        max_sector_fiis: "30",
      },
    });

    const prefs = await getUserPreferences();
    expect(prefs).not.toBeNull();
    expect(prefs?.max_sector_acoes).toBe(25);
    expect(prefs?.max_sector_fiis).toBe(30);
    expect(prefs?.reminders_enabled).toBe(true);
    expect(prefs?.reminder_days_before_bill).toBe(5);
  });

  it("updateSectorCaps atualiza limites setoriais", async () => {
    builder = makeBuilder({ error: null });
    await updateSectorCaps({ maxSectorAcoes: 30, maxSectorFiis: 40 });
    expect(lastUpdateInput).toEqual({
      max_sector_acoes: 30,
      max_sector_fiis: 40,
    });
  });

  it("updateReminderPreferences atualiza preferências de lembretes", async () => {
    builder = makeBuilder({ error: null });
    await updateReminderPreferences({
      remindersEnabled: false,
      reminderDaysBeforeDebt: 5,
      reminderDaysBeforeBill: 4,
    });
    expect(lastUpdateInput).toEqual({
      reminders_enabled: false,
      reminder_days_before_debt: 5,
      reminder_days_before_bill: 4,
    });
  });

  it("updateCustomSettings atualiza configurações customizadas JSONB", async () => {
    builder = makeBuilder({
      data: {
        user_id: "u1",
        custom_settings: { density: "comfortable" },
      },
      error: null,
    });
    await updateCustomSettings({ density: "compact", soundEnabled: true });
    expect(lastUpdateInput).toEqual({
      custom_settings: {
        density: "compact",
        soundEnabled: true,
        dashboardWidgets: {},
        headerButtons: {},
      },
    });
  });

  it("propaga erro ao falhar atualização", async () => {
    builder = makeBuilder({ error: null });
    lastError = { message: "db error", code: "PGRST" };
    await expect(updateReminderPreferences({ remindersEnabled: true })).rejects.toThrow();
  });
});
