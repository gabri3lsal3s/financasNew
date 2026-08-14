import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDensity, setDensity, toggleDensity, useDensity } from "./use-density";

beforeEach(() => {
  window.localStorage.clear();
  setDensity("comfortable");
});

afterEach(() => {
  window.localStorage.clear();
  setDensity("comfortable");
});

describe("useDensity (F8 — Decisão 4)", () => {
  it("inicia confortável por padrão", () => {
    expect(getDensity()).toBe("comfortable");
    const { result } = renderHook(() => useDensity());
    expect(result.current).toBe("comfortable");
  });

  it("toggle alterna e persiste no localStorage", () => {
    const { result } = renderHook(() => useDensity());

    act(() => toggleDensity());
    expect(result.current).toBe("compact");
    expect(window.localStorage.getItem("financas_density")).toBe("compact");

    act(() => toggleDensity());
    expect(result.current).toBe("comfortable");
    expect(window.localStorage.getItem("financas_density")).toBe("comfortable");
  });

  it("lê a preferência persistida no primeiro acesso", () => {
    window.localStorage.setItem("financas_density", "compact");
    expect(getDensity()).toBe("compact");
  });
});
