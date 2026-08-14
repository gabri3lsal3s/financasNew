import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureOwnProfile } from "./profiles";
import { AppError } from "@/services/errors";

interface UpsertCall {
  table: string;
  values: Record<string, unknown>;
  options: { onConflict: string; ignoreDuplicates: boolean };
}

const PREFERENCES_DEFAULTS = {
  user_id: "u1",
  theme: "system",
  reminders_enabled: true,
  reminder_days_before_debt: 3,
  reminder_days_before_bill: 3,
  report_weights_enabled: true,
  max_sector_acoes: null,
  max_sector_fiis: null,
};

let calls: UpsertCall[] = [];
/** Fila de erros por chamada (undefined = sucesso). */
let errorQueue: ({ message: string } | null)[] = [];

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      upsert: (values: Record<string, unknown>, options: UpsertCall["options"]) => {
        calls.push({ table, values, options });
        const error = errorQueue[calls.length - 1] ?? null;
        return Promise.resolve({ error });
      },
    }),
  }),
}));

describe("ensureOwnProfile — auto-cura de contas órfãs (F11)", () => {
  beforeEach(() => {
    calls = [];
    errorQueue = [];
  });

  it("faz upsert de profiles (on conflict do nothing) e de preferências padrão", async () => {
    await ensureOwnProfile("u1", "ana@exemplo.com", "Ana");

    expect(calls).toHaveLength(2);
    const [profile, preferences] = calls;
    expect(profile?.table).toBe("profiles");
    expect(profile?.values).toEqual({ id: "u1", email: "ana@exemplo.com", name: "Ana" });
    expect(profile?.options).toEqual({ onConflict: "id", ignoreDuplicates: true });
    expect(preferences?.table).toBe("user_preferences");
    expect(preferences?.values).toEqual(PREFERENCES_DEFAULTS);
    expect(preferences?.options).toEqual({ onConflict: "user_id", ignoreDuplicates: true });
  });

  it("normaliza campos opcionais vazios para null (nunca string vazia)", async () => {
    await ensureOwnProfile("u2", "", "");

    expect(calls[0]?.values).toEqual({ id: "u2", email: null, name: null });
  });

  it("é idempotente: ignoreDuplicates garante que não sobrescreve perfil existente", async () => {
    await ensureOwnProfile("u1");
    await ensureOwnProfile("u1");

    expect(calls).toHaveLength(4);
    expect(calls.every((call) => call.options.ignoreDuplicates)).toBe(true);
  });

  it("propaga violação de FK como AppError de validação (Dados inválidos) preservando o raw", async () => {
    errorQueue = [{ message: "insert or update on table \"profiles\" violates foreign key constraint" }];
    const promise = ensureOwnProfile("u1");
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toThrow(/Dados inválidos/);
    const error = await promise.catch((err: unknown) => err);
    expect((error as AppError).kind).toBe("validation");
    expect((error as AppError).raw).toEqual({
      message: "insert or update on table \"profiles\" violates foreign key constraint",
    });
  });

  it("propaga erro de user_preferences quando o perfil passou", async () => {
    errorQueue = [null, { message: "boom" }];
    await expect(ensureOwnProfile("u1")).rejects.toThrow(/boom/);
    expect(calls[0]?.table).toBe("profiles");
  });
});
