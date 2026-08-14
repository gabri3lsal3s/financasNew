import { describe, expect, it, vi, beforeEach } from "vitest";
import { listFeedback, setFeedback } from "./insight-feedback";

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

describe("insight-feedback (repository — aprendizado §3.7.4)", () => {
  beforeEach(() => {
    lastError = null;
    lastUpsertInput = null;
    lastDeleteArgs = [];
  });

  it("listFeedback devolve as linhas de decisão persistidas", async () => {
    builder = makeBuilder({
      data: [
        { occurrence_key: "alert:overspend:2026-08", decision: "ignore" },
        { occurrence_key: "sub:netflix:2026-08", decision: "confirm" },
      ],
    });
    const rows = await listFeedback();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ occurrence_key: "alert:overspend:2026-08", decision: "ignore" });
  });

  it("setFeedback grava via upsert com chave de conflito user+occurrence", async () => {
    builder = makeBuilder({ error: null });
    await setFeedback("sub:spotify:2026-08", "ignore");
    expect(lastUpsertInput).toMatchObject({
      user_id: "u1",
      occurrence_key: "sub:spotify:2026-08",
      decision: "ignore",
    });
  });

  it("setFeedback(null) restaura apagando a linha do usuário", async () => {
    builder = makeBuilder({ error: null });
    await setFeedback("sub:spotify:2026-08", null);
    lastDeleteArgs = builder.eq.mock.calls.map((call: unknown[]) => call[1]);
    expect(lastDeleteArgs).toEqual(["u1", "sub:spotify:2026-08"]);
  });

  it("propaga erro classificado quando a gravação falha", async () => {
    builder = makeBuilder({ error: null });
    lastError = { message: "network down", code: "NETWORK_ERROR" };
    await expect(setFeedback("k", "ignore")).rejects.toThrow();
  });
});
