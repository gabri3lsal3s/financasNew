import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listAllocationTargets,
  listGroupTargets,
  removeGroupTarget,
  saveAllocationTargets,
  saveGroupTarget,
} from "./allocation-targets";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastRpcCall: { fn: string; args: unknown } | null = null;

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockReturnValue(builder);
  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: () => builder,
    rpc: (fn: string, args: unknown) => {
      lastRpcCall = { fn, args };
      return { then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(cb) };
    },
  }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: async () => "u1",
}));

describe("allocation-targets repository (Fase 4 — metas §3.11.1)", () => {
  beforeEach(() => {
    lastRpcCall = null;
  });

  it("listAllocationTargets converte numeric → number na borda", async () => {
    builder = makeBuilder({
      data: [{ id: "t1", user_id: "u1", asset_id: "a1", target_percentage: "30" }],
    });
    const targets = await listAllocationTargets();
    expect(targets[0]).toMatchObject({ asset_id: "a1", target_percentage: 30 });
  });

  it("saveAllocationTargets chama o RPC transacional com o lote", async () => {
    await saveAllocationTargets([
      { assetId: "a1", target: 40 },
      { assetId: "a2", target: 60 },
    ]);
    expect(lastRpcCall?.fn).toBe("set_allocation_targets");
    expect(lastRpcCall?.args).toEqual({
      p_targets: [
        { asset_id: "a1", target_percentage: 40 },
        { asset_id: "a2", target_percentage: 60 },
      ],
    });
  });

  it("listGroupTargets busca a tabela certa por tipo", async () => {
    builder = makeBuilder({
      data: [{ id: "g1", user_id: "u1", group_type: "class", name: "Renda Fixa", target_percentage: "40" }],
    });
    const groups = await listGroupTargets("class");
    expect(groups[0]).toMatchObject({ name: "Renda Fixa", target_percentage: 40 });
  });

  it("saveGroupTarget delega ao RPC set_group_target", async () => {
    await saveGroupTarget("sector", "Bancos", 15);
    expect(lastRpcCall?.fn).toBe("set_group_target");
    expect(lastRpcCall?.args).toEqual({ p_group_type: "sector", p_name: "Bancos", p_target: 15 });
  });

  it("removeGroupTarget delega ao RPC remove_group_target", async () => {
    await removeGroupTarget("class", "Renda Fixa");
    expect(lastRpcCall?.fn).toBe("remove_group_target");
    expect(lastRpcCall?.args).toEqual({ p_group_type: "class", p_name: "Renda Fixa" });
  });

  it("propaga erro classificado quando a leitura falha", async () => {
    builder = makeBuilder({ data: null, error: { message: "network down", code: "NETWORK_ERROR" } });
    await expect(listAllocationTargets()).rejects.toThrow();
  });
});
