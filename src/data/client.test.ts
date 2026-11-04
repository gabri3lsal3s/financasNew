import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("@/lib/env", () => ({
  getSupabaseEnv: vi.fn(() => ({
    url: "https://example.supabase.co",
    anonKey: "mock-anon-key-12345",
  })),
}));

describe("data/client — getSupabase", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    createClientMock.mockReturnValue({
      auth: {},
      from: vi.fn(),
      rpc: vi.fn(),
    });
  });

  it("deve inicializar o Supabase client com flowType PKCE estrito e flags de sessao", async () => {
    const { getSupabase } = await import("./client");
    const client = getSupabase();

    expect(client).toBeDefined();
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "mock-anon-key-12345",
      {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  });

  it("deve retornar a mesma instancia singleton em chamadas subsequentes", async () => {
    const { getSupabase } = await import("./client");
    const client1 = getSupabase();
    const client2 = getSupabase();

    expect(client1).toBe(client2);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
});
