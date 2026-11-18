import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGuestIdentityStore } from "./use-guest-identity-store";

describe("useGuestIdentityStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("isola prefixos de storage entre os escopos split e trip", () => {
    const splitHook = renderHook(() => useGuestIdentityStore("split", "tok-1"));
    const tripHook = renderHook(() => useGuestIdentityStore("trip", "tok-1"));

    act(() => {
      splitHook.result.current.setActiveId("p_2");
    });

    expect(splitHook.result.current.activeId).toBe("p_2");
    expect(tripHook.result.current.activeId).toBeNull();
    expect(window.localStorage.getItem("axis_guest_split_tok-1")).toBe("p_2");

    act(() => {
      tripHook.result.current.setActiveId("m_3");
    });

    expect(tripHook.result.current.activeId).toBe("m_3");
    expect(window.localStorage.getItem("axis_guest_member_tok-1")).toBe("m_3");
  });
});
