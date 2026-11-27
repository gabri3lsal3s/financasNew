/**
 * Observabilidade — F6.3 (decisão: Sentry) e endurecimento S09.
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
 * • Números de cartão de crédito (13 a 19 dígitos com ou sem separador);
 * • Chaves de autorização, JWTs e tokens em strings;
 * • Endereços de e-mail em texto livre;
 * • Parâmetros confidenciais em query strings e URLs.
 */
const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]?){12,18}\d\b/g;
const BEARER_TOKEN_REGEX = /\b(Bearer\s+)[a-zA-Z0-9_.-]{20,}\b/gi;
const JWT_REGEX = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const QUERY_PARAM_REGEX =
  /((?:^|[?&])(?:password|senha|secret|token|access_token|accessToken|refresh_token|refreshToken|intent_token|intentToken|csrf|csrf_token|csrfToken|x-axir-csrf|context_id|contextId|x-axir-context|session|session_id|sessionId|authorization|apikey|api_key|cvv|cvc|ccv|card_number|cardNumber|cardCcv|pan|holderName|postalCode|addressNumber|phone|cpf|email)=)[^&#\s]+/gi;

/** Chaves de contexto que contêm senhas, tokens, sessão, CSRF, contextId, e-mail ou PII. */
const SENSITIVE_KEYS_REGEX =
  /^(?:password|senha|secret|token|.*_?token|authorization|apikey|api_?key|jwt|bearer|csrf|x[-_]axir[-_]csrf|x[-_]csrf[-_]token|context_?id|x[-_]axir[-_]context|session|session_?id|session_?key|session_?context|cvv|cvc|ccv|card_?ccv|card_?cvv|card_?number|credit_?card|card|pan|expiry_?month|expiry_?year|expiry|holder_?name|cpf|cnpj|account_?number|email|.*_?email|email_?address|phone|mobile_?phone|postal_?code|cep|address_?number|cookie|set-cookie)$/i;

/**
 * Chaves de custódia de sessão/PII que devem ser removidas (omitidas) de objetos
 * de eventos e breadcrumbs além do mascaramento padrão (S09).
 */
const STRIPPED_TELEMETRY_KEYS_REGEX =
  /^(?:access_?token|refresh_?token|id_?token|intent_?token|session_?token|auth_?token|csrf|csrf_?token|x[-_]axir[-_]csrf|x[-_]csrf[-_]token|context_?id|x[-_]axir[-_]context|session|session_?id|session_?key|session_?context|user_?email|masked_?email|email_?address)$/i;

/**
 * Higieniza recursivamente qualquer payload de contexto antes de enviar à telemetria:
 * - Remove chaves de custódia de sessão (csrf, contextId, session, access/refresh token, userEmail);
 * - Redige valores em chaves confidenciais;
 * - Mascara CPFs, cartões, JWTs, e-mails e parâmetros confidenciais em strings;
 * - Previne vazamento de PII e dados financeiros em logs.
 */
export function scrubSensitiveData<T>(input: T): T {
  if (typeof input === "string") {
    return input
      .replace(CPF_REGEX, "[REDACTED_CPF]")
      .replace(CREDIT_CARD_REGEX, "[REDACTED_CARD]")
      .replace(BEARER_TOKEN_REGEX, "$1[REDACTED_TOKEN]")
      .replace(JWT_REGEX, "[REDACTED_TOKEN]")
      .replace(QUERY_PARAM_REGEX, "$1[REDACTED]")
      .replace(EMAIL_REGEX, "[REDACTED_EMAIL]") as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => scrubSensitiveData(item)) as unknown as T;
  }

  if (input !== null && typeof input === "object") {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (STRIPPED_TELEMETRY_KEYS_REGEX.test(key)) {
        continue;
      }
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

interface TelemetryBreadcrumbLike {
  data?: Record<string, unknown>;
  message?: string;
}

interface TelemetryEventLike {
  extra?: Record<string, unknown>;
  breadcrumbs?: TelemetryBreadcrumbLike[];
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  user?: Record<string, unknown>;
  request?: {
    url?: string;
    query_string?: unknown;
    data?: unknown;
    headers?: Record<string, string>;
  };
}

/** Higieniza um breadcrumb antes do envio à telemetria (S09). */
export function sanitizeTelemetryBreadcrumb<T extends TelemetryBreadcrumbLike>(breadcrumb: T): T {
  return {
    ...breadcrumb,
    data: breadcrumb.data ? (scrubSensitiveData(breadcrumb.data) as Record<string, unknown>) : undefined,
    message: breadcrumb.message ? (scrubSensitiveData(breadcrumb.message) as string) : undefined,
  };
}

/** Higieniza um evento completo do Sentry antes do envio (S09). */
export function sanitizeTelemetryEvent<T extends TelemetryEventLike>(event: T): T {
  if (event.extra) {
    event.extra = scrubSensitiveData(event.extra) as Record<string, unknown>;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => sanitizeTelemetryBreadcrumb(b));
  }
  if (event.message) {
    event.message = scrubSensitiveData(event.message) as string;
  }
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((ex) => ({
      ...ex,
      value: ex.value ? (scrubSensitiveData(ex.value) as string) : ex.value,
    }));
  }
  if (event.contexts) {
    event.contexts = scrubSensitiveData(event.contexts) as typeof event.contexts;
  }
  if (event.tags) {
    event.tags = scrubSensitiveData(event.tags) as typeof event.tags;
  }
  if (event.user) {
    const sanitizedUser: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event.user)) {
      if (key === "email" || STRIPPED_TELEMETRY_KEYS_REGEX.test(key) || SENSITIVE_KEYS_REGEX.test(key)) {
        continue;
      }
      sanitizedUser[key] = scrubSensitiveData(value);
    }
    event.user = sanitizedUser;
  }
  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubSensitiveData(event.request.url);
    }
    if (event.request.query_string) {
      event.request.query_string = scrubSensitiveData(event.request.query_string);
    }
    if (event.request.data !== undefined) {
      event.request.data = scrubSensitiveData(event.request.data);
    }
    if (event.request.headers) {
      event.request.headers = scrubSensitiveData(event.request.headers) as Record<string, string>;
    }
  }
  return event;
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
      beforeBreadcrumb(breadcrumb) {
        return sanitizeTelemetryBreadcrumb(breadcrumb);
      },
      beforeSend(event) {
        return sanitizeTelemetryEvent(event);
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
 * Correlaciona os erros ao usuário autenticado (apenas id anônimo) — chamar após o
 * login. Sem DSN → no-op.
 *
 * Em conformidade com a LGPD e Privacy by Design, nunca enviamos e-mail ou
 * outros dados de identificação pessoal em texto claro para a telemetria externa.
 */
export async function setObservabilityUser(user: { id: string; email?: string | null } | null): Promise<void> {
  if (!sentryDsn()) return;
  await initObservability();
  const Sentry = await import("@sentry/react");
  if (user === null) {
    Sentry.setUser(null);
    return;
  }
  // LGPD Privacy by Design: correlaciona apenas por UUID opaco sem expor e-mail pessoal
  Sentry.setUser({ id: user.id });
}
