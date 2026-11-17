import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listGroupTargets,
  removeGroupTarget,
  saveGroupTarget,
  saveHierarchyTargets,
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
      return { then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: true, error: null }).then(cb) };
    },
  }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: async () => "u1",
}));

describe("allocation-targets repository (metas hierárquicas §3.11.1)", () => {
  beforeEach(() => {
    lastRpcCall = null;
  });

  it("listGroupTargets busca a tabela certa por tipo e preserva class_name em setores", async () => {
    builder = makeBuilder({
      data: [
        {
          id: "g1",
          user_id: "u1",
          group_type: "sector",
          class_name: "Ações Brasil",
          name: "Bancos",
          target_percentage: "40",
        },
      ],
    });
    const groups = await listGroupTargets("sector");
    expect(groups[0]).toMatchObject({
      class_name: "Ações Brasil",
      name: "Bancos",
      target_percentage: 40,
    });
  });

  it("saveGroupTarget delega ao RPC set_group_target com className opcional para setores", async () => {
    await saveGroupTarget("sector", "Bancos", 15, "Ações Brasil");
    expect(lastRpcCall?.fn).toBe("set_group_target");
    expect(lastRpcCall?.args).toEqual({
      p_group_type: "sector",
      p_name: "Bancos",
      p_target: 15,
      p_class_name: "Ações Brasil",
    });
  });

  it("removeGroupTarget delega ao RPC remove_group_target com className opcional para setores", async () => {
    await removeGroupTarget("sector", "Bancos", "Ações Brasil");
    expect(lastRpcCall?.fn).toBe("remove_group_target");
    expect(lastRpcCall?.args).toEqual({
      p_group_type: "sector",
      p_name: "Bancos",
      p_class_name: "Ações Brasil",
    });
  });

  it("saveHierarchyTargets envia classes e setores atomicamente via RPC", async () => {
    await saveHierarchyTargets({
      classes: [{ name: "Ações", target_percentage: 60 }, { name: "FIIs", target_percentage: 40 }],
      sectors: [{ class_name: "Ações", name: "Bancos", target_percentage: 50 }],
    });
    expect(lastRpcCall?.fn).toBe("save_portfolio_hierarchy_targets");
    expect(lastRpcCall?.args).toEqual({
      p_classes: [
        { name: "Ações", target_percentage: 60 },
        { name: "FIIs", target_percentage: 40 },
      ],
      p_sectors: [{ class_name: "Ações", name: "Bancos", target_percentage: 50 }],
    });
  });

  it("propaga erro classificado quando a leitura falha", async () => {
    builder = makeBuilder({ data: null, error: { message: "network down", code: "NETWORK_ERROR" } });
    await expect(listGroupTargets("class")).rejects.toThrow();
  });
});
