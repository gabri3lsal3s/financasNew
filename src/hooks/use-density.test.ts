import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDensity, toggleDensity, useDensity, resetDensity } from "./use-density";
import { setActiveUserId, getUserStorageKey } from "@/services/user-storage";

beforeEach(() => {
  window.localStorage.clear();
  setActiveUserId(null);
  resetDensity(null);
});

afterEach(() => {
  window.localStorage.clear();
  setActiveUserId(null);
  resetDensity(null);
});

describe("useDensity (F8 — Decisão 4)", () => {
  it("inicia confortável por padrão", () => {
    expect(getDensity()).toBe("comfortable");
    const { result } = renderHook(() => useDensity());
    expect(result.current).toBe("comfortable");
  });

  it("toggle alterna e persiste no storage isolado por usuário", () => {
    setActiveUserId("user-42");
    resetDensity("user-42");

    const { result } = renderHook(() => useDensity());

    act(() => toggleDensity());
    expect(result.current).toBe("compact");
    expect(window.localStorage.getItem(getUserStorageKey("density", "user-42"))).toBe("compact");

    act(() => toggleDensity());
    expect(result.current).toBe("comfortable");
    expect(window.localStorage.getItem(getUserStorageKey("density", "user-42"))).toBe("comfortable");
  });

  it("lê a preferência persistida no primeiro acesso", () => {
    setActiveUserId("user-99");
    window.localStorage.setItem("financas_user-99_density", "compact");
    resetDensity("user-99");
    expect(getDensity()).toBe("compact");
  });
});
