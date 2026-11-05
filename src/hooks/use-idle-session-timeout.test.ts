import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useIdleSessionTimeout,
  DEFAULT_IDLE_TIMEOUT_MS,
  IDLE_ACTIVITY_EVENTS,
} from "./use-idle-session-timeout";
import * as authModule from "@/hooks/use-auth";
import * as demoModule from "@/state/demo-mode";
import * as platformModule from "@/services/native/platform";
import * as signOutModule from "@/hooks/use-sign-out";
import * as toastModule from "@/services/toast";

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: vi.fn(),
}));

vi.mock("@/services/native/platform", () => ({
  isNativePlatform: vi.fn(),
}));

vi.mock("@/state/demo-mode", () => ({
  useDemoSession: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

describe("useIdleSessionTimeout", () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockSignOut.mockResolvedValue(undefined);
    vi.mocked(signOutModule.useSignOut).mockReturnValue({
      signOut: mockSignOut,
    });

    vi.mocked(platformModule.isNativePlatform).mockReturnValue(false);
    vi.mocked(demoModule.useDemoSession).mockReturnValue({
      isDemoActive: false,
      activeTrack: null,
      currentStepIndex: 0,
    } as never);

    vi.mocked(authModule.useAuth).mockReturnValue({
      session: {
        user: { id: "user-123", email: "user@exemplo.com" },
      } as never,
      user: { id: "user-123", email: "user@exemplo.com" } as never,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exporta a constante de tempo limite de 20 minutos (1.200.000 ms)", () => {
    expect(DEFAULT_IDLE_TIMEOUT_MS).toBe(20 * 60 * 1000);
  });

  it("inicia com monitoramento ativo e escuta os 4 eventos de atividade passivamente no ambiente Web", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    const { result } = renderHook(() => useIdleSessionTimeout());

    expect(result.current.isMonitoringActive).toBe(true);

    for (const eventName of IDLE_ACTIVITY_EVENTS) {
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        eventName,
        expect.any(Function),
        { passive: true },
      );
    }
  });

  it("dispara pushToast discreto e signOut quando o tempo limite de 20 minutos expira", async () => {
    renderHook(() => useIdleSessionTimeout());

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(toastModule.pushToast).not.toHaveBeenCalled();

    // Avança 20 minutos
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
    });

    expect(toastModule.pushToast).toHaveBeenCalledWith({
      title: "Sessão encerrada por inatividade para sua proteção.",
      variant: "info",
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("executa callback opcional onTimeout fornecido nas opções", async () => {
    const onTimeoutMock = vi.fn();

    renderHook(() =>
      useIdleSessionTimeout({
        onTimeout: onTimeoutMock,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
    });

    expect(onTimeoutMock).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("reinicia a contagem quando o usuário interage via pointerdown", async () => {
    renderHook(() => useIdleSessionTimeout());

    // Avança 15 minutos (sem expirar)
    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    // Usuário interage
    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    // Avança mais 10 minutos (total 25m, mas 10m após interação)
    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    // Avança os 10 minutos restantes para completar os 20 minutos pós-interação
    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("reinicia a contagem com outros eventos de atividade (keydown, touchstart, scroll)", async () => {
    renderHook(() => useIdleSessionTimeout());

    // keydown
    await act(async () => {
      vi.advanceTimersByTime(18 * 60 * 1000);
      window.dispatchEvent(new Event("keydown"));
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    // touchstart
    await act(async () => {
      vi.advanceTimersByTime(18 * 60 * 1000);
      window.dispatchEvent(new Event("touchstart"));
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    // scroll
    await act(async () => {
      vi.advanceTimersByTime(18 * 60 * 1000);
      window.dispatchEvent(new Event("scroll"));
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    // Expira 20 minutos após o último scroll
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("permite reinicialização manual via resetTimer()", async () => {
    const { result } = renderHook(() => useIdleSessionTimeout());

    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    await act(async () => {
      result.current.resetTimer();
    });

    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(mockSignOut).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("permanece inativo em ambiente nativo móvel (isNativePlatform === true)", async () => {
    vi.mocked(platformModule.isNativePlatform).mockReturnValue(true);

    const { result } = renderHook(() => useIdleSessionTimeout());

    expect(result.current.isMonitoringActive).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS * 2);
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(toastModule.pushToast).not.toHaveBeenCalled();
  });

  it("permanece inativo quando em modo de demonstração (isDemoActive === true)", async () => {
    vi.mocked(demoModule.useDemoSession).mockReturnValue({
      isDemoActive: true,
      activeTrack: null,
      currentStepIndex: 0,
    } as never);

    const { result } = renderHook(() => useIdleSessionTimeout());

    expect(result.current.isMonitoringActive).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS * 2);
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(toastModule.pushToast).not.toHaveBeenCalled();
  });

  it("permanece inativo quando não houver usuário logado (session === null)", async () => {
    vi.mocked(authModule.useAuth).mockReturnValue({
      session: null,
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    const { result } = renderHook(() => useIdleSessionTimeout());

    expect(result.current.isMonitoringActive).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS * 2);
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(toastModule.pushToast).not.toHaveBeenCalled();
  });

  it("respeita a opção enabled: false", async () => {
    const { result } = renderHook(() =>
      useIdleSessionTimeout({ enabled: false }),
    );

    expect(result.current.isMonitoringActive).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS * 2);
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(toastModule.pushToast).not.toHaveBeenCalled();
  });

  it("remove event listeners e limpa o timer ao desmontar", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useIdleSessionTimeout());

    unmount();

    for (const eventName of IDLE_ACTIVITY_EVENTS) {
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        eventName,
        expect.any(Function),
      );
    }
  });

  it("desconecta imediatamente caso a aba volte a ficar visível após o tempo limite (visibilitychange)", async () => {
    renderHook(() => useIdleSessionTimeout({ timeoutMs: 5000 }));

    // Simula passagem de tempo em aba de segundo plano
    await act(async () => {
      vi.advanceTimersByTime(6000);
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(toastModule.pushToast).toHaveBeenCalledWith({
      title: "Sessão encerrada por inatividade para sua proteção.",
      variant: "info",
    });
  });

  it("reagenda o timer para o tempo restante ao voltar à aba visível antes do tempo limite", async () => {
    renderHook(() => useIdleSessionTimeout({ timeoutMs: 10000 }));

    // Avança 4 segundos e simula retorno à aba
    await act(async () => {
      vi.advanceTimersByTime(4000);
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockSignOut).not.toHaveBeenCalled();

    // Avança mais 6 segundos (completando 10s)
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
