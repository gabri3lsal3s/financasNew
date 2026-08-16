/**
 * Observabilidade — F6.3 (decisão: Sentry).
 *
 * Inicialização env-gated por `VITE_SENTRY_DSN` (definido apenas em produção):
 * • sem DSN (dev/testes) → **no-op total**, zero bundle impact (o SDK é
 *   importado dinamicamente e nunca entra no chunk principal sem DSN);
 * • com DSN → Sentry.init com performance (browserTracing captura as
 *   Web Vitals LCP/INP/CLS — métricas básicas) + handlers globais de erro.
 *
 * O gateway de erros (`services/errors`) permanece a fonte de mensagens pt-BR;
 * aqui só se CAPTURA (crash/unexpected) — erros esperados (validação, rede,
 * 401) não poluem o plano gratuito.
 */

let initPromise: Promise<void> | null = null;

/** DSN configurado via VITE_SENTRY_DSN (vazio = observabilidade desligada). */
function sentryDsn(): string {
  return import.meta.env.VITE_SENTRY_DSN ?? "";
}

/** Observabilidade ligada (DSN presente)? */
export function isObservabilityEnabled(): boolean {
  return sentryDsn() !== "";
}

/** Inicializa o Sentry (uma única vez). Sem DSN, resolve sem efeito. */
export function initObservability(): Promise<void> {
  if (!sentryDsn()) return Promise.resolve();
  initPromise ??= (async () => {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: sentryDsn(),
      // Web Vitals (LCP/INP/CLS) + spans de navegação — métricas básicas.
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.1, // amostragem para caber no plano gratuito
    });
  })();
  return initPromise;
}

/**
 * Reporta um erro inesperado (crash/unexpected) ao Sentry com contexto.
 * Sem DSN → no-op. Espera a inicialização para não perder o evento.
 */
export async function reportError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!sentryDsn()) return;
  await initObservability();
  const Sentry = await import("@sentry/react");
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Correlaciona os erros ao usuário autenticado (id/e-mail) — chamar após o
 * login. Sem DSN → no-op.
 */
export async function setObservabilityUser(user: { id: string; email?: string | null } | null): Promise<void> {
  if (!sentryDsn()) return;
  await initObservability();
  const Sentry = await import("@sentry/react");
  if (user === null) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email ?? undefined });
}
