import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerDevice,
  getUserDevices,
  checkDeviceRevoked,
  revokeDevice,
  deleteDevice,
} from "./devices";
import * as authSessionsRpc from "@/data/rpc/auth-sessions";

vi.mock("@/data/rpc/auth-sessions", () => ({
  registerDeviceSessionRpc: vi.fn(),
  checkDeviceSessionRevokedRpc: vi.fn(),
  revokeDeviceSessionRpc: vi.fn(),
}));

const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    from: mockFrom,
  }),
}));

describe("devices repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
      single: mockSingle,
    });
    mockUpsert.mockReturnValue({
      select: () => ({
        single: mockSingle,
      }),
    });
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
    mockDelete.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });
  });

  describe("registerDevice", () => {
    it("registra o dispositivo via RPC quando disponível", async () => {
      const mockResult = {
        id: "rec-1",
        user_id: "user-123",
        device_id: "dev-abc",
        device_name: "Chrome no Windows",
        browser: "Google Chrome",
        os: "Windows",
        ip_address: null,
        last_seen_at: "2026-11-11T10:00:00Z",
        created_at: "2026-11-11T10:00:00Z",
        is_revoked: false,
      };

      vi.mocked(authSessionsRpc.registerDeviceSessionRpc).mockResolvedValueOnce(mockResult);

      const res = await registerDevice({
        deviceId: "dev-abc",
        deviceName: "Chrome no Windows",
        browser: "Google Chrome",
        os: "Windows",
      });

      expect(res).toEqual(mockResult);
      expect(authSessionsRpc.registerDeviceSessionRpc).toHaveBeenCalledWith({
        deviceId: "dev-abc",
        deviceName: "Chrome no Windows",
        browser: "Google Chrome",
        os: "Windows",
      });
    });

    it("usa fallback de tabela quando RPC falha", async () => {
      vi.mocked(authSessionsRpc.registerDeviceSessionRpc).mockRejectedValueOnce(new Error("RPC missing"));

      const mockResult = {
        id: "rec-fallback",
        user_id: "user-123",
        device_id: "dev-abc",
        device_name: "Chrome no Windows",
        browser: "Google Chrome",
        os: "Windows",
        ip_address: null,
        last_seen_at: "2026-11-11T10:00:00Z",
        created_at: "2026-11-11T10:00:00Z",
        is_revoked: false,
      };

      mockSingle.mockResolvedValueOnce({ data: mockResult, error: null });

      const res = await registerDevice({
        deviceId: "dev-abc",
        deviceName: "Chrome no Windows",
        browser: "Google Chrome",
        os: "Windows",
      });

      expect(res).toEqual(mockResult);
      expect(mockFrom).toHaveBeenCalledWith("user_devices");
    });
  });

  describe("getUserDevices", () => {
    it("retorna lista de dispositivos ordenada", async () => {
      const list = [
        { id: "1", device_id: "dev-1", last_seen_at: "2026-11-11T12:00:00Z" },
        { id: "2", device_id: "dev-2", last_seen_at: "2026-11-11T11:00:00Z" },
      ];
      mockOrder.mockResolvedValueOnce({ data: list, error: null });

      const res = await getUserDevices();
      expect(res).toEqual(list);
      expect(mockFrom).toHaveBeenCalledWith("user_devices");
    });
  });

  describe("checkDeviceRevoked", () => {
    it("retorna booleano via RPC", async () => {
      vi.mocked(authSessionsRpc.checkDeviceSessionRevokedRpc).mockResolvedValueOnce(false);
      const isRevoked = await checkDeviceRevoked("dev-123");
      expect(isRevoked).toBe(false);
    });

    it("usa fallback de tabela quando RPC falha", async () => {
      vi.mocked(authSessionsRpc.checkDeviceSessionRevokedRpc).mockRejectedValueOnce(new Error("RPC fail"));
      mockMaybeSingle.mockResolvedValueOnce({ data: { is_revoked: true }, error: null });

      const isRevoked = await checkDeviceRevoked("dev-123");
      expect(isRevoked).toBe(true);
    });
  });

  describe("revokeDevice", () => {
    it("executa revogação via RPC", async () => {
      vi.mocked(authSessionsRpc.revokeDeviceSessionRpc).mockResolvedValueOnce(true);
      const res = await revokeDevice("rec-123");
      expect(res).toBe(true);
      expect(authSessionsRpc.revokeDeviceSessionRpc).toHaveBeenCalledWith("rec-123");
    });
  });

  describe("deleteDevice", () => {
    it("executa deleção via tabela", async () => {
      mockEq.mockResolvedValueOnce({ error: null });
      await deleteDevice("rec-123");
      expect(mockFrom).toHaveBeenCalledWith("user_devices");
    });
  });
});
