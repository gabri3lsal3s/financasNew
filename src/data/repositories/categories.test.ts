import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listCategories,
  createCategory,
  seedDefaultCategories,
  ensureDefaultCategories,
} from "./categories";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.upsert.mockReturnValue(builder);
  builder.single.mockReturnValue(builder);
  return builder;
}

let builder: Builder;
const mockRpc = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: () => builder,
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-123"),
}));

describe("categories repository", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    builder = makeBuilder({
      data: [
        {
          id: "cat-1",
          user_id: "user-123",
          type: "expense",
          name: "Supermercado",
          icon: "shopping-cart",
          color: "#10B981",
          is_reserved: false,
          is_active: true,
          is_family: true,
        },
        {
          id: "cat-2",
          user_id: "user-123",
          type: "expense",
          name: "Jogos",
          icon: "gamepad",
          color: "#6366F1",
          is_reserved: false,
          is_active: true,
          is_family: false,
        },
      ],
      error: null,
    });
  });

  it("mapeia is_family boolean corretamente em listCategories", async () => {
    const categories = await listCategories("expense");
    expect(categories).toHaveLength(2);
    expect(categories[0]?.is_family).toBe(true);
    expect(categories[1]?.is_family).toBe(false);
  });

  it("persiste is_family ao chamar createCategory", async () => {
    builder = makeBuilder({
      data: {
        id: "cat-3",
        user_id: "user-123",
        type: "expense",
        name: "Contas da Casa",
        icon: "home",
        color: "#F59E0B",
        is_reserved: false,
        is_active: true,
        is_family: true,
      },
      error: null,
    });

    const created = await createCategory({
      type: "expense",
      name: "Contas da Casa",
      icon: "home",
      color: "#F59E0B",
      is_family: true,
    });

    expect(created.id).toBe("cat-3");
    expect(created.is_family).toBe(true);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_family: true,
        name: "Contas da Casa",
      }),
    );
  });

  it("persiste family_id ao chamar createCategory para categoria familiar compartilhada", async () => {
    builder = makeBuilder({
      data: {
        id: "cat-4",
        user_id: "user-123",
        type: "expense",
        name: "Supermercado Compartilhado",
        icon: "shopping-cart",
        color: "#10B981",
        is_reserved: false,
        is_active: true,
        is_family: true,
        family_id: "fam-100",
      },
      error: null,
    });

    const created = await createCategory({
      type: "expense",
      name: "Supermercado Compartilhado",
      icon: "shopping-cart",
      color: "#10B981",
      is_family: true,
      family_id: "fam-100",
    });

    expect(created.id).toBe("cat-4");
    expect(created.is_family).toBe(true);
    expect(created.family_id).toBe("fam-100");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_family: true,
        family_id: "fam-100",
        name: "Supermercado Compartilhado",
      }),
    );
  });

  describe("seedDefaultCategories", () => {
    it("delega ao RPC seed_default_categories quando disponível", async () => {
      mockRpc.mockResolvedValueOnce({ data: 11, error: null });

      const count = await seedDefaultCategories();
      expect(mockRpc).toHaveBeenCalledWith("seed_default_categories");
      expect(count).toBe(11);
      expect(builder.upsert).not.toHaveBeenCalled();
    });

    it("utiliza fallback batch upsert se o RPC retornar erro (banco não migrado)", async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: "function not found" } });
      builder = makeBuilder({
        data: Array.from({ length: 11 }, (_, i) => ({ id: `cat-${i}` })),
        error: null,
      });

      const count = await seedDefaultCategories();
      expect(count).toBe(11);
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "Alimentação", type: "expense" }),
          expect.objectContaining({ name: "Salário", type: "income" }),
        ]),
        expect.objectContaining({
          onConflict: "user_id,type,name",
          ignoreDuplicates: true,
        }),
      );
    });
  });

  describe("ensureDefaultCategories", () => {
    it("não executa seed se o usuário já possuir categorias não-reservadas", async () => {
      builder = makeBuilder({
        count: 5,
        data: null,
        error: null,
      });

      const seeded = await ensureDefaultCategories("user-123");
      expect(seeded).toBe(false);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("executa seed se o usuário tiver 0 categorias não-reservadas", async () => {
      builder = makeBuilder({
        count: 0,
        data: null,
        error: null,
      });
      mockRpc.mockResolvedValueOnce({ data: 11, error: null });

      const seeded = await ensureDefaultCategories("user-123");
      expect(seeded).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("seed_default_categories");
    });
  });
});

