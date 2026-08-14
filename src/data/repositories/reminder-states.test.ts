import { describe, expect, it, vi, beforeEach } from "vitest";
import { listReminderStates, setReminderState } from "./reminder-states";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastError: unknown = null;
let lastUpsertInput: unknown = null;
let lastDeleteArgs: unknown[] = [];

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.upsert.mockImplementation((input: unknown) => {
    lastUpsertInput = input;
    return { then: (cb: (v: unknown) => unknown) => Promise.resolve({ error: lastError }).then(cb) };
  });
  builder.delete.mockReturnValue(builder);
  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({ from: () => builder }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: async () => "u1",
}));

describe("reminder-states (repository — §3.10)", () => {
  beforeEach(() => {
    lastError = null;
    lastUpsertInput = null;
    lastDeleteArgs = [];
  });

  it("listReminderStates devolve as linhas persistidas", async () => {
    builder = makeBuilder({
      data: [
        { occurrence_key: "bill:c1:2026-08", kind: "read", snooze_until: null },
        { occurrence_key: "debt:d1", kind: "snoozed", snooze_until: "2026-08-15" },
      ],
    });
    const rows = await listReminderStates();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ occurrence_key: "bill:c1:2026-08", kind: "read", snooze_until: null });
  });

  it("setReminderState grava via upsert com chave de conflito user+occurrence", async () => {
    builder = makeBuilder({ error: null });
    await setReminderState("debt:d1", { kind: "snoozed", snoozeUntil: "2026-08-15" });
    expect(lastUpsertInput).toMatchObject({
      user_id: "u1",
      occurrence_key: "debt:d1",
      kind: "snoozed",
      snooze_until: "2026-08-15",
    });
  });

  it("setReminderState(null) restaura apagando a linha", async () => {
    builder = makeBuilder({ error: null });
    await setReminderState("debt:d1", null);
    lastDeleteArgs = builder.eq.mock.calls.map((call: unknown[]) => call[1]);
    expect(lastDeleteArgs).toEqual(["u1", "debt:d1"]);
  });

  it("propaga erro classificado quando a gravação falha", async () => {
    builder = makeBuilder({ error: null });
    lastError = { message: "network down", code: "NETWORK_ERROR" };
    await expect(setReminderState("k", { kind: "read" })).rejects.toThrow();
  });
});
