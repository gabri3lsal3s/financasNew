import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { useNetworkStatus } from "./use-network-status";
import { resetNetworkStatusForTesting } from "@/services/network-status";

describe("useNetworkStatus hook", () => {
  beforeEach(() => {
    resetNetworkStatusForTesting(true);
  });

  it("inicia com status online e atualiza em transições offline/online", () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
  });
});
