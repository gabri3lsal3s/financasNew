import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionContext,
  resetSessionContextForTests,
  setSessionContext,
} from "@/services/session-context";
import {
  AXIR_CONTEXT_HEADER,
  AXIR_CSRF_HEADER,
  SessionTransportError,
  isSessionTransportError,
  postDataOperation,
  postSessionOperation,
} from "./session-transport";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("data/session-transport", () => {
  beforeEach(() => {
    resetSessionContextForTests();
    setSessionContext({
      status: "authenticated",
      contextId: "ctx-123",
      csrfToken: "csrf-456",
      generation: 1,
      revision: 1,
      environment: "production",
      mode: "personal",
      accountRef: "acc-1",
      displayName: "Conta 1",
      expiresAt: Date.now() + 60_000,
    });
  });

  it("envia POST /api/sessions/v1/:operation com credentials include e headers de contexto/CSRF", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await postSessionOperation<{ ok: boolean }>(
      "revalidate",
      { reason: "bfcache" },
      { fetchImpl: fetchMock },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/sessions/v1/revalidate");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
    expect(init?.headers).toEqual({
      "content-type": "application/json",
      accept: "application/json",
      [AXIR_CONTEXT_HEADER]: "ctx-123",
      [AXIR_CSRF_HEADER]: "csrf-456",
    });
    expect(init?.body).toBe(JSON.stringify({ reason: "bfcache" }));
  });

  it("envia POST /api/data/v1/:operation com credentials include e headers de contexto/CSRF", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ items: [1, 2] }));

    const result = await postDataOperation<{ items: number[] }>(
      "transactions.list",
      { month: "2026-11" },
      { fetchImpl: fetchMock },
    );

    expect(result).toEqual({ items: [1, 2] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/data/v1/transactions.list");
    expect(init?.credentials).toBe("include");
    expect(init?.headers).toEqual({
      "content-type": "application/json",
      accept: "application/json",
      [AXIR_CONTEXT_HEADER]: "ctx-123",
      [AXIR_CSRF_HEADER]: "csrf-456",
    });
  });

  it("descarta resposta tardia em postDataOperation quando o contexto muda durante a requisição", async () => {
    let resolveFetch!: (res: Response) => void;
    const fetchMock = vi.fn<typeof fetch>().mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const pending = postDataOperation<{ balance: number }>("overview.read", {}, { fetchImpl: fetchMock });

    // Troca/logout acontece antes da resposta voltar
    clearSessionContext("neutral");
    resolveFetch(jsonResponse({ balance: 9999 }));

    await expect(pending).rejects.toMatchObject({
      name: "SessionTransportError",
      code: "stale_context",
      status: 0,
      retryable: false,
    });
  });

  it("propaga erro HTTP sem fallback para SDK Supabase no navegador", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ code: "context_stale", message: "Contexto desatualizado." }, 409));

    try {
      await postDataOperation("cards.list", {}, { fetchImpl: fetchMock });
      expect.fail("Deveria lançar SessionTransportError");
    } catch (error) {
      expect(isSessionTransportError(error)).toBe(true);
      const transportError = error as SessionTransportError;
      expect(transportError.code).toBe("context_stale");
      expect(transportError.status).toBe(409);
      expect(transportError.retryable).toBe(false);
      expect(transportError.message).toBe("Contexto desatualizado.");
    }
  });

  it("propaga erro de rede como SessionTransportError retryable sem fallback", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      postSessionOperation("bootstrap", {}, { fetchImpl: fetchMock }),
    ).rejects.toMatchObject({
      name: "SessionTransportError",
      code: "network_error",
      status: 0,
      retryable: true,
    });
  });

  it("rejeita nomes de operação inválidos com path traversal", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      postDataOperation("../admin/dump", {}, { fetchImpl: fetchMock }),
    ).rejects.toMatchObject({
      code: "invalid_payload",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
