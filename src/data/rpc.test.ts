import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminDeleteUser, deleteCurrentUserAccount, deleteOwnAccount } from "./rpc";
import { AppError } from "@/services/errors";

const rpcMock = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

describe("RPC: Exclusão de Contas e Usuários", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteCurrentUserAccount", () => {
    it("deve executar a RPC delete_current_user_account com sucesso", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(deleteCurrentUserAccount()).resolves.toBeUndefined();
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("delete_current_user_account", {});
    });

    it("deve propagar AppError quando a RPC retornar erro", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Acesso não autenticado.", code: "42501" },
      });

      await expect(deleteCurrentUserAccount()).rejects.toThrow(AppError);
      expect(rpcMock).toHaveBeenCalledWith("delete_current_user_account", {});
    });
  });

  describe("deleteOwnAccount (alias)", () => {
    it("deve delegar para delete_current_user_account com sucesso", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(deleteOwnAccount()).resolves.toBeUndefined();
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("delete_current_user_account", {});
    });
  });

  describe("adminDeleteUser", () => {
    it("deve executar a RPC admin_delete_user com target_user_id correto", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(adminDeleteUser({ targetUserId: "target-uuid-123" })).resolves.toBeUndefined();
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("admin_delete_user", {
        target_user_id: "target-uuid-123",
      });
    });

    it("deve propagar AppError quando a RPC falhar (ex: usuário tentando autoexclusão)", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Superadmins não podem se autoexcluir por esta função.", code: "P0001" },
      });

      await expect(adminDeleteUser({ targetUserId: "same-uuid" })).rejects.toThrow(AppError);
      expect(rpcMock).toHaveBeenCalledWith("admin_delete_user", {
        target_user_id: "same-uuid",
      });
    });
  });
});
