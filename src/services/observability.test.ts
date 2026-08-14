import { beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();
const captureExceptionMock = vi.fn();
const setUserMock = vi.fn();

vi.mock("@sentry/react", () => ({
  init: initMock,
  captureException: captureExceptionMock,
  setUser: setUserMock,
  browserTracingIntegration: vi.fn(() => ({ name: "browserTracing" })),
}));

/**
 * F6.3 — Observabilidade (Sentry env-gated por VITE_SENTRY_DSN).
 * Sem DSN: no-op total e zero chamadas ao SDK; com DSN: init com tracing
 * (Web Vitals LCP/INP/CLS), captureException com contexto e setUser.
 */
describe("services/observability (F6.3 — Sentry)", () => {
  beforeEach(() => {
    vi.resetModules(); // estado do módulo (initPromise) isolado por teste
    vi.unstubAllEnvs();
    initMock.mockClear();
    captureExceptionMock.mockClear();
    setUserMock.mockClear();
  });

  it("sem VITE_SENTRY_DSN: desligada e no-op total (sem carregar o SDK)", async () => {
    const obs = await import("@/services/observability");
    expect(obs.isObservabilityEnabled()).toBe(false);
    await expect(obs.initObservability()).resolves.toBeUndefined();
    await obs.reportError(new Error("qualquer"));
    await obs.setObservabilityUser({ id: "u1" });
    expect(initMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(setUserMock).not.toHaveBeenCalled();
  });

  it("com DSN: init configura o Sentry com tracing (Web Vitals)", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://exemplo@ingest.sentry.io/1");
    const obs = await import("@/services/observability");
    expect(obs.isObservabilityEnabled()).toBe(true);
    await obs.initObservability();
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://exemplo@ingest.sentry.io/1", tracesSampleRate: 0.1 }),
    );
  });

  it("init é idempotente (uma única chamada ao SDK)", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://exemplo@ingest.sentry.io/1");
    const obs = await import("@/services/observability");
    await obs.initObservability();
    await obs.initObservability();
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it("reportError captura a exceção com contexto extra", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://exemplo@ingest.sentry.io/1");
    const obs = await import("@/services/observability");
    const error = new Error("falha inesperada");
    await obs.reportError(error, { screen: "transacoes" });
    expect(captureExceptionMock).toHaveBeenCalledWith(error, { extra: { screen: "transacoes" } });
  });

  it("setObservabilityUser correlaciona o usuário e limpa com null", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://exemplo@ingest.sentry.io/1");
    const obs = await import("@/services/observability");
    await obs.setObservabilityUser({ id: "u1", email: "a@b.com" });
    expect(setUserMock).toHaveBeenCalledWith({ id: "u1", email: "a@b.com" });
    await obs.setObservabilityUser(null);
    expect(setUserMock).toHaveBeenLastCalledWith(null);
  });
});
