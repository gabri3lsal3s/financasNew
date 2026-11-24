import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useIdleSessionTimeout,
  DEFAULT_IDLE_WARNING_SECONDS,
  getIdleActivityStorageKey,
} from "./use-idle-session-timeout";
import * as authModule from "@/hooks/use-auth";
import * as demoModule from "@/state/demo-mode";
import * as appLockModule from "@/services/native/app-lock";
import * as platformModule from "@/services/native/platform";
import * as signOutModule from "@/hooks/use-sign-out";
import * as toastModule from "@/services/toast";
import {
  setIdleLogoutPolicy,
  setSharedDeviceSession,
} from "@/services/session-policy";

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: vi.fn(),
}));

vi.mock("@/services/native/platform", () => ({
  isNativePlatform: vi.fn(),
}));

vi.mock("@/services/native/app-lock", () => ({
  isAppLocked: vi.fn(() => false),
  setAppLockIdlePaused: vi.fn(),
}));

vi.mock("@/state/demo-mode", () => ({
  useDemoSession: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

describe("useIdleSessionTimeout (v2.0 — Opt-in, Multi-aba e Precedência AppLock)", () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();

    mockSignOut.mockResolvedValue(undefined);
    vi.mocked(signOutModule.useSignOut).mockReturnValue({
      signOut: mockSignOut,
    });

    vi.mocked(platformModule.isNativePlatform).mockReturnValue(false);
    vi.mocked(appLockModule.isAppLocked).mockReturnValue(false);
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
    localStorage.clear();
    sessionStorage.clear();
  });

  it("padrão 'never': não desloga nem exibe aviso mesmo após 2 horas, mas emite heartbeat multi-aba para Admin", async () => {
    const { result } = renderHook(() => useIdleSessionTimeout());

    expect(result.current.isMonitoringActive).toBe(false);
    expect(result.current.isWarningVisible).toBe(false);

    // Emite atividade inicial no localStorage
    const storageKey = getIdleActivityStorageKey("user-123");
    const initialRaw = localStorage.getItem(storageKey);
    expect(initialRaw).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(result.current.isWarningVisible).toBe(false);

    // Interação no App em modo 'never' atualiza o heartbeat para manter aba Admin viva
    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    const updatedRaw = localStorage.getItem(storageKey);
    expect(updatedRaw).not.toBeNull();
  });

  it("opt-in (15m): exibe aviso prévio de 60s baseado em timestamp e desloga ao expirar", async () => {
    setIdleLogoutPolicy("15m", "user-123");
    const { result } = renderHook(() => useIdleSessionTimeout());

    expect(result.current.isMonitoringActive).toBe(true);
    expect(result.current.isWarningVisible).toBe(false);

    // Avança 14 minutos -> entra na janela de aviso de 60s
    await act(async () => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });

    expect(result.current.isWarningVisible).toBe(true);
    expect(result.current.secondsRemaining).toBe(DEFAULT_IDLE_WARNING_SECONDS);
    expect(appLockModule.setAppLockIdlePaused).toHaveBeenCalledWith(true);
    expect(mockSignOut).not.toHaveBeenCalled();

    // Avança 60s -> expira e encerra sessão localmente
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(toastModule.pushToast).toHaveBeenCalledWith({
      title: "Sessão encerrada por inatividade para sua proteção.",
      variant: "info",
    });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("stayConnected fecha o modal de aviso, retoma AppLock e reseta o contador", async () => {
    setIdleLogoutPolicy("15m", "user-123");
    const { result } = renderHook(() => useIdleSessionTimeout());

    await act(async () => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });
    expect(result.current.isWarningVisible).toBe(true);

    await act(async () => {
      result.current.stayConnected();
    });

    expect(result.current.isWarningVisible).toBe(false);
    expect(appLockModule.setAppLockIdlePaused).toHaveBeenCalledWith(false);

    // Avança mais 10 minutos -> não deve ter expirado
    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("sincronização entre abas: atividade remota recebida via storage event reseta o contador e evita logout", async () => {
    const { result } = renderHook(() =>
      useIdleSessionTimeout({ forcedPolicy: "30m", warningSeconds: 60 }),
    );

    // Avança 29 minutos -> abre modal de aviso
    await act(async () => {
      vi.advanceTimersByTime(29 * 60 * 1000);
    });
    expect(result.current.isWarningVisible).toBe(true);

    // Outra aba (ex.: App de Finanças) envia atividade/stay_connected via storage event
    const now = Date.now();
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: getIdleActivityStorageKey("user-123"),
          newValue: JSON.stringify({
            type: "stay_connected",
            at: now,
            senderId: "other-tab",
          }),
        }),
      );
    });

    expect(result.current.isWarningVisible).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("precedência AppLock: se isAppLocked() === true na janela de 60s, não abre modal e desloga silenciosamente no deadline", async () => {
    setIdleLogoutPolicy("15m", "user-123");
    vi.mocked(appLockModule.isAppLocked).mockReturnValue(true);

    const { result } = renderHook(() => useIdleSessionTimeout());

    await act(async () => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });

    expect(result.current.isWarningVisible).toBe(false);
    expect(mockSignOut).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(result.current.isWarningVisible).toBe(false);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("modo 'Computador compartilhado' e forcedPolicy Admin aplicam 30m automaticamente", async () => {
    setSharedDeviceSession(true);
    const { result } = renderHook(() => useIdleSessionTimeout());
    expect(result.current.isMonitoringActive).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
