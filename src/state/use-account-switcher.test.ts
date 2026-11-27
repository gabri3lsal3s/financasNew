import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AccountSummary,
  LogoutResult,
  OpenTabIntentResult,
  PublicSessionContext,
} from "@/types/session-custody";
import {
  getSessionContext,
  resetSessionContextForTests,
  setSessionContext,
} from "@/services/session-context";
import { SessionTransportError, postSessionOperation } from "@/data/session-transport";
import { useAccountSwitcher } from "./use-account-switcher";

vi.mock("@/data/session-transport", async () => {
  const actual = await vi.importActual<typeof import("@/data/session-transport")>(
    "@/data/session-transport",
  );
  return {
    ...actual,
    postSessionOperation: vi.fn(),
  };
});

const mockedPostSessionOperation = vi.mocked(postSessionOperation);

function makeContext(overrides: Partial<PublicSessionContext> = {}): PublicSessionContext {
  return {
    status: "authenticated",
    contextId: "ctx-a",
    csrfToken: "csrf-a",
    generation: 2,
    revision: 1,
    environment: "production",
    mode: "personal",
    accountRef: "acc-a",
    displayName: "Conta A",
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<AccountSummary> = {}): AccountSummary {
  return {
    accountRef: "acc-a",
    displayName: "Conta A",
    maskedEmail: "co***@exemplo.com",
    mode: "personal",
    status: "active",
    generation: 2,
    lastActivityAt: Date.now(),
    hasLocalLock: false,
    ...overrides,
  };
}

describe("useAccountSwitcher", () => {
  beforeEach(() => {
    resetSessionContextForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetSessionContextForTests();
  });

  it("lista contas visíveis e filtra identidades de operador", async () => {
    setSessionContext(makeContext());
    const accPersonal = makeAccount();
    const accRemembered = makeAccount({
      accountRef: "acc-b",
      displayName: "Conta B",
      maskedEmail: "be***@exemplo.com",
      status: "remembered",
      generation: 3,
    });
    const accOperator = makeAccount({
      accountRef: "acc-op",
      displayName: "Operador Interno",
      maskedEmail: "op***@axir.app",
      mode: "operator",
      status: "remembered",
    });

    mockedPostSessionOperation.mockResolvedValueOnce({
      accounts: [accPersonal, accRemembered, accOperator],
    });

    const { result } = renderHook(() => useAccountSwitcher());

    await act(async () => {
      const res = await result.current.listAccounts();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.accounts).toHaveLength(2);
        expect(res.accounts.map((a) => a.accountRef)).toEqual(["acc-a", "acc-b"]);
      }
    });

    expect(mockedPostSessionOperation).toHaveBeenCalledWith("accounts", {}, { signal: undefined });
    expect(result.current.accounts.some((a) => a.mode === "operator")).toBe(false);
  });

  it("descarta resposta tardia de listAccounts se o contexto mudar durante a requisição", async () => {
    setSessionContext(makeContext({ contextId: "ctx-1", accountRef: "acc-a", generation: 1 }));

    let resolveReq!: (value: { accounts: AccountSummary[] }) => void;
    mockedPostSessionOperation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReq = resolve;
        }),
    );

    const { result } = renderHook(() => useAccountSwitcher());

    let listPromise!: ReturnType<typeof result.current.listAccounts>;
    act(() => {
      listPromise = result.current.listAccounts();
    });

    act(() => {
      setSessionContext(makeContext({ contextId: "ctx-2", accountRef: "acc-b", generation: 2 }));
    });

    await act(async () => {
      resolveReq({ accounts: [makeAccount()] });
      const res = await listPromise;
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("stale_context");
      }
    });

    expect(result.current.accounts).toEqual([]);
  });

  it("alterna conta enviando expectedGeneration e atualiza session-context", async () => {
    setSessionContext(makeContext({ accountRef: "acc-a", generation: 2 }));
    const nextCtx = makeContext({
      contextId: "ctx-b",
      csrfToken: "csrf-b",
      accountRef: "acc-b",
      displayName: "Conta B",
      generation: 4,
    });
    mockedPostSessionOperation.mockResolvedValueOnce(nextCtx);

    const { result } = renderHook(() => useAccountSwitcher());

    await act(async () => {
      const res = await result.current.switchAccount({
        accountRef: "acc-b",
        expectedGeneration: 3,
      });
      expect(res.ok).toBe(true);
    });

    expect(mockedPostSessionOperation).toHaveBeenCalledWith(
      "switch",
      { targetAccountRef: "acc-b", expectedGeneration: 3, localLockSatisfied: false },
      { signal: undefined },
    );
    expect(getSessionContext().accountRef).toBe("acc-b");
    expect(getSessionContext().generation).toBe(4);
    expect(result.current.context.accountRef).toBe("acc-b");
  });

  it("preserva contexto anterior quando switchAccount falha com context_stale ou erro de rede", async () => {
    setSessionContext(makeContext({ accountRef: "acc-a", generation: 2 }));
    mockedPostSessionOperation.mockRejectedValueOnce(
      new SessionTransportError("stale", "context_stale", 409, false),
    );

    const { result } = renderHook(() => useAccountSwitcher());

    await act(async () => {
      const res = await result.current.switchAccount({
        accountRef: "acc-b",
        expectedGeneration: 1,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("context_stale");
      }
    });

    expect(getSessionContext().accountRef).toBe("acc-a");
    expect(result.current.errorCode).toBe("context_stale");
    expect(result.current.error).toContain("Atualize a lista");
  });

  it("abre intenção de nova aba sem alterar o contexto atual", async () => {
    setSessionContext(makeContext({ accountRef: "acc-a", generation: 2 }));
    const intent: OpenTabIntentResult = {
      intentToken: "tok-123",
      expiresAt: Date.now() + 60_000,
    };
    mockedPostSessionOperation.mockResolvedValueOnce(intent);

    const { result } = renderHook(() => useAccountSwitcher());

    await act(async () => {
      const res = await result.current.openTab({
        accountRef: "acc-b",
        expectedGeneration: 3,
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.intent.intentToken).toBe("tok-123");
      }
    });

    expect(mockedPostSessionOperation).toHaveBeenCalledWith(
      "open-tab",
      { targetAccountRef: "acc-b" },
      { signal: undefined },
    );
    expect(getSessionContext().accountRef).toBe("acc-a");
  });

  it("executa logout com remember opt-in (false por padrão) e limpa contexto para neutro", async () => {
    setSessionContext(makeContext({ accountRef: "acc-a" }));
    const logoutRes: LogoutResult = {
      status: "neutral",
      upstreamConfirmed: true,
      pendingRevocations: 0,
    };
    mockedPostSessionOperation.mockResolvedValueOnce(logoutRes);

    const { result } = renderHook(() => useAccountSwitcher());

    await act(async () => {
      const res = await result.current.logout();
      expect(res.ok).toBe(true);
    });

    expect(mockedPostSessionOperation).toHaveBeenCalledWith(
      "logout",
      { remember: false },
      { signal: undefined },
    );
    expect(getSessionContext().status).toBe("neutral");
    expect(result.current.lastLogoutResult?.upstreamConfirmed).toBe(true);
  });

  it("executa logout com remember: true quando consentido e mantém conta como lembrada", async () => {
    setSessionContext(makeContext({ accountRef: "acc-a" }));
    mockedPostSessionOperation.mockResolvedValueOnce({ accounts: [makeAccount()] });
    mockedPostSessionOperation.mockResolvedValueOnce({
      status: "neutral",
      upstreamConfirmed: true,
      pendingRevocations: 0,
    } satisfies LogoutResult);

    const { result } = renderHook(() => useAccountSwitcher());

    await act(async () => {
      await result.current.listAccounts();
    });
    await act(async () => {
      await result.current.logout({ remember: true });
    });

    expect(mockedPostSessionOperation).toHaveBeenLastCalledWith(
      "logout",
      { remember: true },
      { signal: undefined },
    );
    expect(result.current.accounts[0]?.status).toBe("remembered");
  });

  it("executa logoutDevice e limpa contexto e contas locais", async () => {
    setSessionContext(makeContext({ accountRef: "acc-a" }));
    mockedPostSessionOperation.mockResolvedValueOnce({ accounts: [makeAccount()] });
    mockedPostSessionOperation.mockResolvedValueOnce({
      status: "neutral",
      upstreamConfirmed: true,
      pendingRevocations: 0,
    } satisfies LogoutResult);

    const { result } = renderHook(() => useAccountSwitcher());

    await act(async () => {
      await result.current.listAccounts();
    });
    await act(async () => {
      const res = await result.current.logoutDevice();
      expect(res.ok).toBe(true);
    });

    expect(mockedPostSessionOperation).toHaveBeenLastCalledWith(
      "logout-device",
      {},
      { signal: undefined },
    );
    expect(getSessionContext().status).toBe("neutral");
    expect(result.current.accounts).toEqual([]);
  });

  it("esquece conta específica e limpa contexto apenas se for a conta ativa", async () => {
    setSessionContext(makeContext({ accountRef: "acc-a" }));
    const accA = makeAccount({ accountRef: "acc-a", displayName: "Conta A" });
    const accB = makeAccount({ accountRef: "acc-b", displayName: "Conta B", status: "remembered" });
    mockedPostSessionOperation.mockResolvedValueOnce({ accounts: [accA, accB] });
    mockedPostSessionOperation.mockResolvedValueOnce({ forgotten: true });
    mockedPostSessionOperation.mockResolvedValueOnce({ forgotten: true });

    const { result } = renderHook(() => useAccountSwitcher());

    await act(async () => {
      await result.current.listAccounts();
    });

    await act(async () => {
      const res = await result.current.forgetAccount({ accountRef: "acc-b" });
      expect(res.ok).toBe(true);
    });
    expect(getSessionContext().status).toBe("authenticated");
    expect(result.current.accounts.map((a) => a.accountRef)).toEqual(["acc-a"]);

    await act(async () => {
      const res = await result.current.forgetAccount({ accountRef: "acc-a" });
      expect(res.ok).toBe(true);
    });
    expect(getSessionContext().status).toBe("neutral");
    expect(result.current.accounts).toEqual([]);
  });
});
