import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSidebarState } from "./use-sidebar-state";

const STORAGE_KEY = "financas_sidebar_collapsed";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useSidebarState (F7.2)", () => {
  it("inicia expandida por padrão", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(false);
  });

  it("lê a preferência persistida no primeiro render", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(true);
  });

  it("toggle alterna o estado e persiste imediatamente no localStorage", () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => result.current.toggle());
    expect(result.current.isCollapsed).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");

    act(() => result.current.toggle());
    expect(result.current.isCollapsed).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("0");
  });
});
