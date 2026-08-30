import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePermission } from "./use-permission";
import { useUserAccess } from "./use-user-access";
import { useUserSubscription } from "./use-user-subscription";

vi.mock("./use-user-access", () => ({
  useUserAccess: vi.fn(),
}));

vi.mock("./use-user-subscription", () => ({
  useUserSubscription: vi.fn(),
}));

describe("usePermission hook", () => {
  it("deve retornar isHidden = true quando o módulo está desativado pelo Kill-Switch", () => {
    vi.mocked(useUserAccess).mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(false),
      isAdmin: false,
    } as never);

    vi.mocked(useUserSubscription).mockReturnValue({
      canWrite: true,
      isFullAccess: true,
    } as never);

    const { result } = renderHook(() => usePermission("investments"));
    expect(result.current.isHidden).toBe(true);
    expect(result.current.canRead).toBe(false);
    expect(result.current.canWrite).toBe(false);
    expect(result.current.accessLevel).toBe("none");
  });

  it("deve retornar permissão total de admin quando o usuário for admin", () => {
    vi.mocked(useUserAccess).mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(true),
      isAdmin: true,
    } as never);

    vi.mocked(useUserSubscription).mockReturnValue({
      canWrite: false,
    } as never);

    const { result } = renderHook(() => usePermission("transactions"));
    expect(result.current.canRead).toBe(true);
    expect(result.current.canWrite).toBe(true);
    expect(result.current.accessLevel).toBe("admin");
    expect(result.current.isReadOnlyMode).toBe(false);
  });

  it("deve respeitar override modular explícito na assinatura", () => {
    vi.mocked(useUserAccess).mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(true),
      isAdmin: false,
    } as never);

    vi.mocked(useUserSubscription).mockReturnValue({
      canWrite: true,
      moduleAccess: {
        investments: "read",
      },
    } as never);

    const { result } = renderHook(() => usePermission("investments"));
    expect(result.current.canRead).toBe(true);
    expect(result.current.canWrite).toBe(false);
    expect(result.current.isReadOnlyMode).toBe(true);
    expect(result.current.accessLevel).toBe("read");
  });

  it("deve aplicar fallback do modo somente-leitura quando trial encerra", () => {
    vi.mocked(useUserAccess).mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(true),
      isAdmin: false,
    } as never);

    vi.mocked(useUserSubscription).mockReturnValue({
      canWrite: false,
      isReadOnly: true,
      moduleAccess: {},
    } as never);

    const { result } = renderHook(() => usePermission("debts"));
    expect(result.current.canRead).toBe(true);
    expect(result.current.canWrite).toBe(false);
    expect(result.current.isReadOnlyMode).toBe(true);
    expect(result.current.accessLevel).toBe("read");
  });
});
