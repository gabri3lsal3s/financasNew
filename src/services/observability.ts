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

/**
 * Regex para identificação e mascaramento de dados sensíveis em telemetria:
 * • CPFs (formatados ou apenas dígitos contíguos de 11 dígitos);
 * • Números de cartão de crédito (16 dígitos com ou sem separador);
 * • Chaves de autorização e tokens em strings.
 */
const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
const BEARER_TOKEN_REGEX = /\b(Bearer\s+)[a-zA-Z0-9_.-]{20,}\b/gi;

/** Chaves de contexto que contêm senhas, tokens, credenciais ou dados restritos. */
const SENSITIVE_KEYS_REGEX = /^(?:password|senha|secret|token|authorization|apikey|api_key|cvv|cvc|cpf|credit_card|card_number|account_number)$/i;

/**
 * Higieniza recursivamente qualquer payload de contexto antes de enviar à telemetria:
 * - Redige valores em chaves confidenciais;
 * - Mascara CPFs e números de cartão em strings;
 * - Previne vazamento de PII e dados financeiros em logs.
 */
export function scrubSensitiveData<T>(input: T): T {
  if (typeof input === "string") {
    return input
      .replace(CPF_REGEX, "[REDACTED_CPF]")
      .replace(CREDIT_CARD_REGEX, "[REDACTED_CARD]")
      .replace(BEARER_TOKEN_REGEX, "$1[REDACTED_TOKEN]") as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => scrubSensitiveData(item)) as unknown as T;
  }

  if (input !== null && typeof input === "object") {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEYS_REGEX.test(key)) {
        scrubbed[key] = "[REDACTED]";
      } else {
        scrubbed[key] = scrubSensitiveData(value);
      }
    }
    return scrubbed as unknown as T;
  }

  return input;
}

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
      beforeSend(event) {
        if (event.extra) {
          event.extra = scrubSensitiveData(event.extra) as Record<string, unknown>;
        }
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b) => ({
            ...b,
            data: b.data ? (scrubSensitiveData(b.data) as Record<string, unknown>) : undefined,
            message: b.message ? (scrubSensitiveData(b.message) as string) : undefined,
          }));
        }
        if (event.message) {
          event.message = scrubSensitiveData(event.message) as string;
        }
        return event;
      },
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
  const scrubbedContext = context ? (scrubSensitiveData(context) as Record<string, unknown>) : undefined;
  Sentry.captureException(error, scrubbedContext ? { extra: scrubbedContext } : undefined);
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

