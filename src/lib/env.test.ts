import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv } from "./env";

describe("lib/env — getSupabaseEnv", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retorna url e anonKey quando devidamente configurados", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://xyzcompany.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid");

    const env = getSupabaseEnv();
    expect(env.url).toBe("https://xyzcompany.supabase.co");
    expect(env.anonKey).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid");
  });

  it("lança erro quando variáveis obrigatórias estão ausentes", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    expect(() => getSupabaseEnv()).toThrowError(/Configuração incompleta/);
  });

  it("lança erro quando detecta valores padrão de placeholder", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://your-project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid");

    expect(() => getSupabaseEnv()).toThrowError(/contém valores padrão de placeholder/);
  });
});
