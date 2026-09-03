import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getIsOnlineSnapshot,
  resetNetworkStatusForTesting,
  subscribeNetworkStatus,
} from "./network-status";

describe("network-status service", () => {
  beforeEach(() => {
    resetNetworkStatusForTesting(true);
  });

  it("retorna o status de conexão síncrono padrão", () => {
    expect(getIsOnlineSnapshot()).toBe(true);
  });

  it("notifica ouvintes quando o evento offline e online são disparados", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNetworkStatus(listener);

    window.dispatchEvent(new Event("offline"));
    expect(getIsOnlineSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);

    window.dispatchEvent(new Event("online"));
    expect(getIsOnlineSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
    window.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
