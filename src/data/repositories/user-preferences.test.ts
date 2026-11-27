import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getUserPreferences,
  updateReminderPreferences,
  updateCustomSettings,
  updateAppMode,
} from "./user-preferences";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastError: unknown = null;
let lastUpdateInput: unknown = null;
let lastInsertInput: unknown = null;
let customSettingsState: Record<string, unknown> = {};
let casFiltersLog: Array<{ op: string; col: string; val: unknown }> = [];
let updateSelectHandler: (() => unknown) | null = null;
let insertSelectHandler: (() => unknown) | null = null;

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    maybeSingle: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.update.mockImplementation((input: unknown) => {
    lastUpdateInput = input;
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn((col: string, val: unknown) => {
      casFiltersLog.push({ op: "eq", col, val });
      return chain;
    });
    chain.is = vi.fn((col: string, val: unknown) => {
      casFiltersLog.push({ op: "is", col, val });
      return chain;
    });
    chain.select = vi.fn(() => {
      if (updateSelectHandler) {
        return {
          then: (cb: (v: unknown) => unknown) => Promise.resolve(updateSelectHandler!()).then(cb),
        };
      }
      if (input && typeof input === "object" && "custom_settings" in input) {
        customSettingsState = {
          ...((input as { custom_settings?: Record<string, unknown> }).custom_settings ?? {}),
        };
      }
      return {
        then: (cb: (v: unknown) => unknown) =>
          Promise.resolve({ data: lastError ? null : [{ user_id: "u1" }], error: lastError }).then(cb),
      };
    });
    chain.then = (cb: (v: unknown) => unknown) => Promise.resolve({ error: lastError }).then(cb);
    return chain;
  });
  builder.insert.mockImplementation((input: unknown) => {
    lastInsertInput = input;
    return {
      select: vi.fn(() => {
        if (insertSelectHandler) {
          return {
            then: (cb: (v: unknown) => unknown) => Promise.resolve(insertSelectHandler!()).then(cb),
          };
        }
        if (input && typeof input === "object" && "custom_settings" in input) {
          customSettingsState = {
            ...((input as { custom_settings?: Record<string, unknown> }).custom_settings ?? {}),
          };
        }
        return {
          then: (cb: (v: unknown) => unknown) =>
            Promise.resolve({ data: lastError ? null : [{ user_id: "u1" }], error: lastError }).then(cb),
        };
      }),
    };
  });
  builder.upsert.mockImplementation((input: unknown) => {
    if (input && typeof input === "object" && "custom_settings" in input) {
      customSettingsState = {
        ...((input as { custom_settings?: Record<string, unknown> }).custom_settings ?? {}),
      };
    }
    return {
      then: (cb: (v: unknown) => unknown) => Promise.resolve({ error: lastError }).then(cb),
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
    lastInsertInput = null;
    customSettingsState = {};
    casFiltersLog = [];
    updateSelectHandler = null;
    insertSelectHandler = null;
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
      },
    });

    const prefs = await getUserPreferences();
    expect(prefs).not.toBeNull();
    expect(prefs?.reminders_enabled).toBe(true);
    expect(prefs?.reminder_days_before_bill).toBe(5);
    expect(prefs?.app_mode).toBe("investor");
  });

  it("getUserPreferences preserva app_mode quando fornecido como essential", async () => {
    builder = makeBuilder({
      data: {
        user_id: "u1",
        theme: "system",
        reminders_enabled: true,
        reminder_days_before_debt: 3,
        reminder_days_before_bill: 5,
        report_weights_enabled: false,
        app_mode: "essential",
      },
    });

    const prefs = await getUserPreferences();
    expect(prefs?.app_mode).toBe("essential");
  });

  it("updateAppMode atualiza o modo da aplicação", async () => {
    builder = makeBuilder({ error: null });
    await updateAppMode("essential");
    expect(lastUpdateInput).toEqual({
      app_mode: "essential",
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

  it("updateCustomSettings realiza CAS otimista de custom_settings JSONB e serializa gravações concorrentes", async () => {
    builder = makeBuilder({
      data: {
        user_id: "u1",
        custom_settings: { density: "comfortable" },
      },
      error: null,
    });
    builder.maybeSingle.mockImplementation(() => ({
      then: (cb: (v: unknown) => unknown) =>
        Promise.resolve({
          data: {
            user_id: "u1",
            custom_settings:
              Object.keys(customSettingsState).length > 0
                ? customSettingsState
                : { density: "comfortable" },
          },
          error: null,
        }).then(cb),
    }));

    await Promise.all([
      updateCustomSettings({ density: "compact" }),
      updateCustomSettings({ soundEnabled: true }),
    ]);

    expect(casFiltersLog).toContainEqual({
      op: "is",
      col: "custom_settings->>_settingsRev",
      val: null,
    });
    expect(casFiltersLog).toContainEqual({
      op: "eq",
      col: "custom_settings->>_settingsRev",
      val: "1",
    });
    expect(customSettingsState).toMatchObject({
      density: "compact",
      soundEnabled: true,
      _settingsRev: 2,
    });
  });

  it("updateCustomSettings faz retry em conflito CAS e preserva alteração concorrente de outro cliente", async () => {
    let readCount = 0;
    customSettingsState = { _settingsRev: 1, density: "comfortable" };
    builder = makeBuilder({ error: null });
    builder.maybeSingle.mockImplementation(() => {
      readCount += 1;
      if (readCount === 2) {
        // Outro aparelho gravou _settingsRev: 2 com outro campo antes do retry
        customSettingsState = {
          _settingsRev: 2,
          density: "comfortable",
          hapticEnabled: false,
        };
      }
      return {
        then: (cb: (v: unknown) => unknown) =>
          Promise.resolve({
            data: { user_id: "u1", custom_settings: customSettingsState },
            error: null,
          }).then(cb),
      };
    });

    let updateAttempt = 0;
    updateSelectHandler = () => {
      updateAttempt += 1;
      if (updateAttempt === 1) {
        return { data: [], error: null }; // 0 linhas: conflito CAS
      }
      customSettingsState = {
        ...((lastUpdateInput as { custom_settings: Record<string, unknown> }).custom_settings),
      };
      return { data: [{ user_id: "u1" }], error: null };
    };

    await updateCustomSettings({ soundEnabled: true });
    expect(updateAttempt).toBe(2);
    expect(customSettingsState).toMatchObject({
      _settingsRev: 3,
      hapticEnabled: false,
      soundEnabled: true,
    });
  });

  it("updateCustomSettings recupera conflito 23505 no insert inicial e limita tentativas em conflito persistente", async () => {
    let readCount = 0;
    builder = makeBuilder({ error: null });
    builder.maybeSingle.mockImplementation(() => {
      readCount += 1;
      if (readCount === 1) {
        return {
          then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(cb),
        };
      }
      return {
        then: (cb: (v: unknown) => unknown) =>
          Promise.resolve({
            data: { user_id: "u1", custom_settings: { _settingsRev: 1, density: "comfortable" } },
            error: null,
          }).then(cb),
      };
    });

    insertSelectHandler = () => ({ data: null, error: { code: "23505", message: "duplicate" } });
    updateSelectHandler = () => ({ data: [{ user_id: "u1" }], error: null });

    await updateCustomSettings({ soundEnabled: true });
    expect(lastInsertInput).toBeTruthy();

    // Conflito persistente em todas as 3 tentativas dispara erro explícito
    readCount = 1;
    updateSelectHandler = () => ({ data: [], error: null });
    await expect(updateCustomSettings({ soundEnabled: false })).rejects.toThrow(/outro dispositivo/i);
  });

  it("updateCustomSettings preserva e mescla advisorDecayMeta e suporta revogação em advisorDismissals", async () => {
    const futureExpiry = Date.now() + 86_400_000 * 10;
    customSettingsState = {
      advisorDecayMeta: {
        habit: {
          dismissCount: 2,
          lastDismissedAt: "2026-11-20T10:00:00.000Z",
          dismissedUntil: futureExpiry,
        },
      },
      advisorDismissals: {
        "dup:netflix": futureExpiry,
        "habit:cafe": futureExpiry,
      },
    };
    builder = makeBuilder({ error: null });
    builder.maybeSingle.mockImplementation(() => ({
      then: (cb: (v: unknown) => unknown) =>
        Promise.resolve({
          data: {
            user_id: "u1",
            custom_settings: customSettingsState,
          },
          error: null,
        }).then(cb),
    }));

    await updateCustomSettings({
      advisorDecayMeta: {
        pace: {
          dismissCount: 1,
          lastDismissedAt: "2026-11-24T10:00:00.000Z",
          dismissedUntil: futureExpiry,
        },
      },
      advisorDismissals: { "dup:netflix": 0 },
    });

    expect(customSettingsState.advisorDecayMeta).toEqual({
      habit: expect.objectContaining({ dismissCount: 2 }),
      pace: expect.objectContaining({ dismissCount: 1 }),
    });
    expect(customSettingsState.advisorDismissals).toEqual({
      "habit:cafe": futureExpiry,
    });
  });

  it("propaga erro ao falhar atualização", async () => {
    builder = makeBuilder({ error: null });
    lastError = { message: "db error", code: "PGRST" };
    await expect(updateReminderPreferences({ remindersEnabled: true })).rejects.toThrow();
  });
});
