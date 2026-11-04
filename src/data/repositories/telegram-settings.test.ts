import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAdminTelegramSettings,
  updateAdminTelegramSettings,
} from "./telegram-settings";

const mockResolveQuery = vi.fn();

vi.mock("@/data/query", () => ({
  resolveQuery: (...args: unknown[]) => mockResolveQuery(...args),
}));

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({}),
        }),
      }),
      upsert: (payload: unknown) => ({
        select: () => ({
          single: () => ({ payload }),
        }),
      }),
    }),
  }),
}));

describe("telegram-settings repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna configurações padrão quando registro não existe no banco", async () => {
    mockResolveQuery.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const settings = await getAdminTelegramSettings();

    expect(settings).toEqual({
      id: "global",
      notify_support: true,
      notify_git: true,
      notify_deploys: true,
      notify_analytics: false,
      notify_new_users: true,
      silent_mode: false,
      updated_at: expect.any(String),
      updated_by: null,
    });
  });

  it("retorna dados existentes da tabela admin_telegram_settings", async () => {
    const existing = {
      id: "global",
      notify_support: false,
      notify_git: true,
      notify_deploys: false,
      notify_analytics: true,
      notify_new_users: false,
      silent_mode: true,
      updated_at: "2026-08-01T12:00:00Z",
      updated_by: null,
    };

    mockResolveQuery.mockResolvedValueOnce({ data: existing, error: null });

    const settings = await getAdminTelegramSettings();

    expect(settings).toEqual(existing);
  });

  it("atualiza configurações e faz upsert com id global", async () => {
    const existing = {
      id: "global",
      notify_support: true,
      notify_git: true,
      notify_deploys: true,
      notify_analytics: false,
      notify_new_users: true,
      silent_mode: false,
      updated_at: "2026-08-01T12:00:00Z",
      updated_by: null,
    };

    // 1st getAdminTelegramSettings
    mockResolveQuery.mockResolvedValueOnce({ data: existing, error: null });
    // 2nd upsert
    const updatedRecord = { ...existing, silent_mode: true };
    mockResolveQuery.mockResolvedValueOnce({ data: updatedRecord, error: null });

    const result = await updateAdminTelegramSettings({ silent_mode: true });

    expect(result.silent_mode).toBe(true);
  });
});
