import { describe, expect, it, vi } from "vitest";
import {
  createAllocationPreset,
  deleteAllocationPreset,
  listAllocationPresets,
  updateAllocationPreset,
} from "./allocation-presets";
import { getSupabase } from "@/data/client";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
}));

describe("data/repositories/allocation-presets", () => {
  it("listAllocationPresets retorna lista mapeada", async () => {
    const mockData = [
      {
        id: "p1",
        user_id: "u1",
        name: "Cenário 1",
        description: "Desc",
        asset_targets: [{ ticker: "PETR4", target_percentage: 50 }],
        class_targets: [{ name: "Ações", target_percentage: 50 }],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await listAllocationPresets();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Cenário 1");
    expect(result[0]?.asset_targets).toHaveLength(1);
  });

  it("createAllocationPreset insere e retorna preset criado", async () => {
    const mockCreated = {
      id: "p2",
      user_id: "u1",
      name: "Novo Cenário",
      description: null,
      asset_targets: [],
      class_targets: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: mockCreated, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    vi.mocked(getSupabase).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await createAllocationPreset({
      name: "Novo Cenário",
      asset_targets: [],
      class_targets: [],
    });

    expect(result.id).toBe("p2");
    expect(result.name).toBe("Novo Cenário");
  });

  it("updateAllocationPreset atualiza e retorna preset modificado", async () => {
    const mockUpdated = {
      id: "p1",
      user_id: "u1",
      name: "Cenário Atualizado",
      description: "Nova desc",
      asset_targets: [],
      class_targets: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: mockUpdated, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await updateAllocationPreset("p1", {
      name: "Cenário Atualizado",
      description: "Nova desc",
    });

    expect(result.id).toBe("p1");
    expect(result.name).toBe("Cenário Atualizado");
  });

  it("deleteAllocationPreset executa exclusão", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    await expect(deleteAllocationPreset("p1")).resolves.toBeUndefined();
  });
});
