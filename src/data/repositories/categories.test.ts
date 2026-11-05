import { describe, expect, it, vi, beforeEach } from "vitest";
import { listCategories, createCategory } from "./categories";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.single.mockReturnValue(builder);
  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: () => builder,
  }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-123"),
}));

describe("categories repository", () => {
  beforeEach(() => {
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
});
