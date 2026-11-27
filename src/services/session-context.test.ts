import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSessionContext } from "@/types/session-custody";
import {
  captureContext,
  clearSessionContext,
  getSessionContext,
  isContextCurrent,
  registerBfCacheRevalidation,
  resetSessionContextForTests,
  setSessionContext,
  subscribeSessionContext,
} from "./session-context";

function makeContext(overrides: Partial<PublicSessionContext> = {}): PublicSessionContext {
  return {
    status: "authenticated",
    contextId: "ctx-account-a",
    csrfToken: "csrf-token-a",
    generation: 1,
    revision: 1,
    environment: "production",
    mode: "personal",
    accountRef: "acc-a",
    displayName: "Conta A",
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe("services/session-context", () => {
  beforeEach(() => {
    resetSessionContextForTests();
  });

  it("inicia em estado neutro e retorna cópias imutáveis do contexto", () => {
    const initial = getSessionContext();
    expect(initial.status).toBe("neutral");
    expect(initial.contextId).toBeNull();
    expect(initial.csrfToken).toBeNull();
    expect(initial.accountRef).toBeNull();

    const updated = setSessionContext(makeContext());
    updated.csrfToken = "mutated";
    expect(getSessionContext().csrfToken).toBe("csrf-token-a");
  });

  it("descarta respostas tardias após troca de conta via captureContext / isContextCurrent", () => {
    setSessionContext(makeContext());
    const capturedA = captureContext();
    expect(isContextCurrent(capturedA)).toBe(true);

    // Troca para conta B
    setSessionContext(
      makeContext({
        contextId: "ctx-account-b",
        csrfToken: "csrf-token-b",
        accountRef: "acc-b",
        displayName: "Conta B",
        generation: 2,
      }),
    );

    expect(isContextCurrent(capturedA)).toBe(false);
    const capturedB = captureContext();
    expect(isContextCurrent(capturedB)).toBe(true);
  });

  it("descarta respostas tardias após logout e mesmo em re-login subsequente (proteção ABA)", () => {
    const ctxA = makeContext({ contextId: "ctx-a", accountRef: "acc-a", generation: 3 });
    setSessionContext(ctxA);
    const capturedBeforeLogout = captureContext();

    clearSessionContext("neutral");
    expect(isContextCurrent(capturedBeforeLogout)).toBe(false);
    expect(getSessionContext().status).toBe("neutral");
    expect(getSessionContext().contextId).toBeNull();
    expect(getSessionContext().generation).toBe(4);

    // Mesmo se a mesma conta retornar com o mesmo contextId/generation, o snapshot antigo permanece inválido
    setSessionContext(ctxA);
    expect(isContextCurrent(capturedBeforeLogout)).toBe(false);
  });

  it("mantém contexto corrente quando apenas csrfToken/expiresAt é renovado na mesma sessão", () => {
    setSessionContext(makeContext());
    const captured = captureContext();

    setSessionContext(
      makeContext({
        csrfToken: "csrf-rotated",
        expiresAt: Date.now() + 120_000,
      }),
    );

    expect(isContextCurrent(captured)).toBe(true);
    expect(getSessionContext().csrfToken).toBe("csrf-rotated");
  });

  it("notifica assinantes e respeita cancelamento de inscrição", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionContext(listener);

    setSessionContext(makeContext());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ accountRef: "acc-a" }));

    unsubscribe();
    clearSessionContext("revoked");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("dispara revalidação no evento pageshow apenas quando persisted=true (BFCache)", () => {
    setSessionContext(makeContext({ accountRef: "acc-bfcache" }));
    const onRevalidate = vi.fn();
    const cleanup = registerBfCacheRevalidation(onRevalidate, window);

    // Carregamento normal (persisted=false) não deve disparar revalidação
    const normalEvent = new Event("pageshow");
    Object.defineProperty(normalEvent, "persisted", { value: false });
    window.dispatchEvent(normalEvent);
    expect(onRevalidate).not.toHaveBeenCalled();

    // Restauração do BFCache (persisted=true) dispara revalidação com o contexto atual
    const bfCacheEvent = new Event("pageshow");
    Object.defineProperty(bfCacheEvent, "persisted", { value: true });
    window.dispatchEvent(bfCacheEvent);
    expect(onRevalidate).toHaveBeenCalledTimes(1);
    expect(onRevalidate).toHaveBeenCalledWith(
      expect.objectContaining({ accountRef: "acc-bfcache", contextId: "ctx-account-a" }),
    );

    // Após cleanup, não dispara mais
    cleanup();
    window.dispatchEvent(bfCacheEvent);
    expect(onRevalidate).toHaveBeenCalledTimes(1);
  });
});
