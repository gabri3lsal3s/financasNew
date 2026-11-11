import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDevices } from "./use-devices";
import * as devicesRepo from "@/data/repositories/devices";

vi.mock("@/data/repositories/devices", () => ({
  getUserDevices: vi.fn(),
}));

vi.mock("@/services/user-storage", () => ({
  getActiveUserId: vi.fn(() => "user-123"),
}));

describe("useDevices hook", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("carrega e retorna a lista de dispositivos conectados", async () => {
    const mockList = [
      {
        id: "d-1",
        user_id: "user-123",
        device_id: "dev-1",
        device_name: "Chrome no Windows",
        browser: "Google Chrome",
        os: "Windows",
        ip_address: null,
        last_seen_at: "2026-11-11T12:00:00Z",
        created_at: "2026-11-11T12:00:00Z",
        is_revoked: false,
      },
    ];

    vi.mocked(devicesRepo.getUserDevices).mockResolvedValueOnce(mockList);

    const { result } = renderHook(() => useDevices(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockList);
  });
});
