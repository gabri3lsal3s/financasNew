import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSidebarState } from "./use-sidebar-state";
import { setActiveUserId, getUserStorageKey } from "@/services/user-storage";

beforeEach(() => {
  window.localStorage.clear();
  setActiveUserId(null);
});

afterEach(() => {
  window.localStorage.clear();
  setActiveUserId(null);
});

describe("useSidebarState (F7.2)", () => {
  it("inicia expandida por padrão", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(false);
  });

  it("lê a preferência persistida no primeiro render", () => {
    setActiveUserId("user-sb");
    window.localStorage.setItem("financas_user-sb_sidebar_collapsed", "1");
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(true);
  });

  it("toggle alterna o estado e persiste imediatamente no storage do usuário", () => {
    setActiveUserId("user-sb");
    const { result } = renderHook(() => useSidebarState());

    act(() => result.current.toggle());
    expect(result.current.isCollapsed).toBe(true);
    expect(window.localStorage.getItem(getUserStorageKey("sidebar_collapsed", "user-sb"))).toBe("1");

    act(() => result.current.toggle());
    expect(result.current.isCollapsed).toBe(false);
    expect(window.localStorage.getItem(getUserStorageKey("sidebar_collapsed", "user-sb"))).toBe("0");
  });
});
