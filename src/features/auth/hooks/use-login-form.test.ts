import { createElement } from "react";
import type { FormEvent, ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionTransportError, postSessionOperation } from "@/data/session-transport";
import {
  getSessionContext,
  resetSessionContextForTests,
} from "@/services/session-context";
import type { PublicSessionContext } from "@/types/session-custody";
import { LOGIN_MODE_COPY, useLoginForm } from "./use-login-form";

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockSignInWithEmail = vi.fn();
const mockListVerifiedMfaFactors = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
  listVerifiedMfaFactors: (...args: unknown[]) => mockListVerifiedMfaFactors(...args),
  getActiveUserMfaFactor: vi.fn().mockResolvedValue(null),
  markMfaVerified: vi.fn(),
  resendConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  verifyMfaTotpCode: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({ signOut: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@/data/session-transport", async () => {
  const actual = await vi.importActual<typeof import("@/data/session-transport")>(
    "@/data/session-transport",
  );
  return {
    ...actual,
    postSessionOperation: vi.fn(),
  };
});

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "tok-1234567890",
            refresh_token: "ref-1234567890",
          },
        },
      }),
      setSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: "user-hydrated-1" },
          },
        },
        error: null,
      }),
    },
  }),
}));

vi.mock("@/services/native/device-info", () => ({
  markPendingExplicitDeviceRegistration: vi.fn(),
}));

vi.mock("@/services/session-policy", () => ({
  setSharedDeviceSession: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

const mockedPostSessionOperation = vi.mocked(postSessionOperation);

function makeContext(overrides: Partial<PublicSessionContext> = {}): PublicSessionContext {
  return {
    status: "authenticated",
    contextId: "ctx-tab-1",
    csrfToken: "csrf-tab-1",
    generation: 3,
    revision: 1,
    environment: "production",
    mode: "personal",
    accountRef: "acc-1",
    displayName: "Conta Principal",
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [initialEntry] }, children);
  };
}

describe("useLoginForm", () => {
  beforeEach(() => {
    resetSessionContextForTests();
    mockNavigate.mockReset();
    mockedPostSessionOperation.mockReset();
    mockSignInWithEmail.mockReset().mockResolvedValue(undefined);
    mockListVerifiedMfaFactors.mockReset().mockResolvedValue(null);
    mockUseAuth.mockReturnValue({
      session: null,
      loading: false,
      configError: null,
      mfaRequired: false,
      mfaVerified: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("tab_intent", () => {
    it("resgata tab_intent via redeem-tab, atualiza sessionContext e redireciona para from", async () => {
      const ctx = makeContext({ contextId: "ctx-redeemed", accountRef: "acc-redeemed" });
      mockedPostSessionOperation.mockResolvedValueOnce({
        ...ctx,
        sessionBridge: { accessToken: "tok-tab-123", refreshToken: "ref-tab-123" },
      });

      renderHook(() => useLoginForm(), {
        wrapper: createWrapper("/login?tab_intent=intent-abc&redirect=%2Fcartoes"),
      });

      await waitFor(() => {
        expect(mockedPostSessionOperation).toHaveBeenCalledWith("redeem-tab", {
          intentToken: "intent-abc",
        });
      });

      await waitFor(() => {
        expect(getSessionContext().contextId).toBe("ctx-redeemed");
        expect(getSessionContext().accountRef).toBe("acc-redeemed");
        expect(mockNavigate).toHaveBeenCalledWith("/cartoes", { replace: true });
      });
    });

    it("aceita resposta encapsulada em { context } no redeem-tab", async () => {
      const ctx = makeContext({ contextId: "ctx-wrapped" });
      mockedPostSessionOperation.mockResolvedValueOnce({
        context: {
          ...ctx,
          sessionBridge: { accessToken: "tok-wrap-123", refreshToken: "ref-wrap-123" },
        },
      });

      renderHook(() => useLoginForm(), {
        wrapper: createWrapper("/entrar?tab_intent=intent-wrap"),
      });

      await waitFor(() => {
        expect(getSessionContext().contextId).toBe("ctx-wrapped");
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      });
    });

    it("exibe erro quando redeem-tab falha sem redirecionar", async () => {
      mockedPostSessionOperation.mockRejectedValueOnce(
        new SessionTransportError("Token de aba expirado.", "unauthorized", 401, false),
      );

      const { result } = renderHook(() => useLoginForm(), {
        wrapper: createWrapper("/login?tab_intent=expired-token"),
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Token de aba expirado.");
        expect(result.current.isRedeemingTabIntent).toBe(false);
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("mode", () => {
    it.each(["add", "reauth", "unlock"] as const)(
      "retorna titulo e subtitulo contextuais para mode=%s e evita auto-redirect com sessao ativa",
      (mode) => {
        mockUseAuth.mockReturnValue({
          session: { user: { id: "u-1" } },
          loading: false,
          configError: null,
          mfaRequired: false,
          mfaVerified: true,
        });

        const { result } = renderHook(() => useLoginForm(), {
          wrapper: createWrapper(`/login?mode=${mode}`),
        });

        expect(result.current.loginMode).toBe(mode);
        expect(result.current.loginTitle).toBe(LOGIN_MODE_COPY[mode].title);
        expect(result.current.loginSubtitle).toBe(LOGIN_MODE_COPY[mode].subtitle);
        expect(result.current.shouldRedirect).toBe(false);
      },
    );

    it("usa modo default quando mode ausente ou invalido", () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: "u-1" } },
        loading: false,
        configError: null,
        mfaRequired: false,
        mfaVerified: true,
      });

      const { result } = renderHook(() => useLoginForm(), {
        wrapper: createWrapper("/entrar?mode=desconhecido"),
      });

      expect(result.current.loginMode).toBe("default");
      expect(result.current.loginTitle).toBe(LOGIN_MODE_COPY.default.title);
      expect(result.current.loginSubtitle).toBe(LOGIN_MODE_COPY.default.subtitle);
      expect(result.current.shouldRedirect).toBe(true);
    });
  });

  describe("sincronizacao BFF no submit com senha", () => {
    it("sincroniza custodia BFF em modo personal e grava sessionContext", async () => {
      const ctx = makeContext({ contextId: "ctx-password", mode: "personal" });
      mockedPostSessionOperation.mockResolvedValueOnce(ctx);

      const { result } = renderHook(() => useLoginForm(), {
        wrapper: createWrapper("/login"),
      });

      act(() => {
        result.current.setEmail("usuario@exemplo.com");
        result.current.setPassword("SenhaSegura123!");
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
      });

      expect(mockSignInWithEmail).toHaveBeenCalledWith("usuario@exemplo.com", "SenhaSegura123!", undefined);
      expect(mockedPostSessionOperation).toHaveBeenCalledWith("login", {
        grant: "session-sync",
        mode: "personal",
        accessToken: "tok-1234567890",
        refreshToken: "ref-1234567890",
      });
      expect(getSessionContext().contextId).toBe("ctx-password");
      expect(result.current.error).toBeNull();
    });

    it("mantem login Supabase funcionando se BFF falhar em modo shared", async () => {
      mockedPostSessionOperation.mockRejectedValueOnce(
        new SessionTransportError("Indisponível", "service_unavailable", 503, true),
      );

      const { result } = renderHook(() => useLoginForm(), {
        wrapper: createWrapper("/login?mode=add&redirect=%2Ftransacoes"),
      });

      act(() => {
        result.current.setEmail("shared@exemplo.com");
        result.current.setPassword("SenhaShared123!");
        result.current.setIsSharedDevice(true);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
      });

      expect(mockSignInWithEmail).toHaveBeenCalledWith("shared@exemplo.com", "SenhaShared123!", undefined);
      expect(mockedPostSessionOperation).toHaveBeenCalledWith("login", {
        grant: "session-sync",
        mode: "shared",
        accessToken: "tok-1234567890",
        refreshToken: "ref-1234567890",
      });
      expect(result.current.error).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith("/transacoes", { replace: true });
    });
  });
});
