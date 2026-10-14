import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMutationGuard } from "./use-mutation-guard";

const navigateMock = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

let mockSubscription = {
  canWrite: true,
  isReadOnly: false,
};

vi.mock("@/state", () => ({
  useUserSubscription: () => mockSubscription,
}));

describe("useMutationGuard hook", () => {
  it("executa a ação diretamente quando canWrite for true", () => {
    mockSubscription = { canWrite: true, isReadOnly: false };
    const { result } = renderHook(() => useMutationGuard());

    expect(result.current.canWrite).toBe(true);
    expect(result.current.isReadOnlyMode).toBe(false);

    const action = vi.fn();
    act(() => {
      result.current.guardAction(action, "Criar Lançamento");
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("bloqueia a ação e abre o diálogo quando isReadOnly for true", () => {
    mockSubscription = { canWrite: false, isReadOnly: true };
    const { result } = renderHook(() => useMutationGuard({ defaultContext: "Contexto Geral" }));

    expect(result.current.canWrite).toBe(false);
    expect(result.current.isReadOnlyMode).toBe(true);

    const action = vi.fn();
    act(() => {
      result.current.guardAction(action, "Editar Transação");
    });

    // Ação não deve ter sido executada
    expect(action).not.toHaveBeenCalled();
    // Modal está pronto para exibição
    expect(result.current.upgradeModal).toBeTruthy();
  });
});
