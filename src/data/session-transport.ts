/**
 * Transporte HTTP de custódia de sessão e dados via BFF (T04).
 *
 * Chama exclusivamente `POST /api/sessions/v1/:operation` e `POST /api/data/v1/:operation`
 * com `credentials: "include"`, `x-axir-context` e `x-axir-csrf`.
 * Não possui qualquer fallback para o SDK do Supabase no navegador em caso de erro.
 */

import type { SessionErrorCode, SessionOperation } from "@/types/session-custody";
import { captureContext, getSessionContext, isContextCurrent } from "@/services/session-context";
import { isNativePlatform } from "@/services/native/platform";

export const SESSION_API_BASE_PATH = "/api/sessions/v1";
export const DATA_API_BASE_PATH = "/api/data/v1";
export const AXIR_CONTEXT_HEADER = "x-axir-context";
export const AXIR_CSRF_HEADER = "x-axir-csrf";
export const AXIR_NATIVE_INSTALLATION_HEADER = "x-axir-native-installation";

const NATIVE_INSTALLATION_STORAGE_KEY = "axir_native_installation_id";

function getNativeApiOrigin(): string {
  const configured =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env.VITE_SESSIONS_API_ORIGIN as string | undefined)
      : undefined;
  return (configured?.trim() || "https://axir.com.br").replace(/\/+$/, "");
}

function getOrCreateNativeInstallationId(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const existing = window.localStorage.getItem(NATIVE_INSTALLATION_STORAGE_KEY);
    if (existing && /^[a-f0-9]{32,64}$/i.test(existing)) {
      return existing;
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const generated = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(NATIVE_INSTALLATION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return null;
  }
}

export type SessionTransportErrorCode =
  | SessionErrorCode
  | "network_error"
  | "stale_context"
  | "invalid_response";

export interface TransportRequestOptions {
  signal?: AbortSignal;
  contextId?: string | null;
  csrfToken?: string | null;
  requireCurrentContext?: boolean;
  fetchImpl?: typeof fetch;
}

const OPERATION_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const KNOWN_SESSION_ERROR_CODES = new Set<SessionErrorCode>([
  "unauthorized",
  "context_stale",
  "step_up_required",
  "limit_reached",
  "service_unavailable",
  "invalid_payload",
  "invalid_origin",
  "forbidden_host",
]);

export class SessionTransportError extends Error {
  readonly code: SessionTransportErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(
    message: string,
    code: SessionTransportErrorCode,
    status: number,
    retryable: boolean,
    details?: unknown,
  ) {
    super(message);
    this.name = "SessionTransportError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

export function isSessionTransportError(error: unknown): error is SessionTransportError {
  return error instanceof SessionTransportError;
}

function resolveFallbackErrorCode(status: number): SessionErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 409) return "context_stale";
  if (status === 400 || status === 422) return "invalid_payload";
  return "service_unavailable";
}

function parseErrorPayload(body: unknown, status: number): { code: SessionErrorCode; message: string } {
  const fallbackCode = resolveFallbackErrorCode(status);
  if (body !== null && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const rawCode =
      typeof record.code === "string"
        ? record.code
        : typeof record.error === "string"
          ? record.error
          : null;
    const code =
      rawCode && KNOWN_SESSION_ERROR_CODES.has(rawCode as SessionErrorCode)
        ? (rawCode as SessionErrorCode)
        : fallbackCode;
    const message =
      typeof record.message === "string" && record.message.trim() !== ""
        ? record.message
        : typeof record.error === "string" && record.error.trim() !== ""
          ? record.error
          : `Falha na operação (${status}).`;
    return { code, message };
  }

  return { code: fallbackCode, message: `Falha na operação (${status}).` };
}

async function safeParseJson(response: Response): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const data: unknown = await response.json();
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

async function postOperation<TResponse, TPayload>(
  basePath: string,
  operation: string,
  payload: TPayload | undefined,
  options: TransportRequestOptions,
  defaultRequireCurrentContext: boolean,
): Promise<TResponse> {
  const normalizedOp = operation.trim();
  if (!OPERATION_NAME_REGEX.test(normalizedOp)) {
    throw new SessionTransportError("Operação de transporte inválida.", "invalid_payload", 0, false);
  }

  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new SessionTransportError("Transporte HTTP indisponível.", "service_unavailable", 0, false);
  }

  const captured = captureContext();
  const activeContext = getSessionContext();
  const contextId = options.contextId !== undefined ? options.contextId : activeContext.contextId;
  const csrfToken = options.csrfToken !== undefined ? options.csrfToken : activeContext.csrfToken;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };

  if (contextId) {
    headers[AXIR_CONTEXT_HEADER] = contextId;
  }
  if (csrfToken) {
    headers[AXIR_CSRF_HEADER] = csrfToken;
  }

  const nativeRuntime = isNativePlatform();
  if (nativeRuntime) {
    const nativeId = getOrCreateNativeInstallationId();
    if (nativeId) {
      headers[AXIR_NATIVE_INSTALLATION_HEADER] = nativeId;
    }
  }

  const resolvedBasePath = nativeRuntime ? `${getNativeApiOrigin()}${basePath}` : basePath;
  const url = `${resolvedBasePath}/${encodeURIComponent(normalizedOp)}`;
  const requireCurrentContext = options.requireCurrentContext ?? defaultRequireCurrentContext;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers,
      body: JSON.stringify(payload ?? {}),
      signal: options.signal,
    });
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    throw new SessionTransportError(
      isAbort ? "Requisição cancelada." : "Falha de rede ao comunicar com o servidor.",
      "network_error",
      0,
      !isAbort,
      error,
    );
  }

  if (requireCurrentContext && !isContextCurrent(captured)) {
    throw new SessionTransportError(
      "Contexto de sessão alterado durante a requisição.",
      "stale_context",
      0,
      false,
    );
  }

  if (!response.ok) {
    const parsed = await safeParseJson(response);
    const { code, message } = parseErrorPayload(parsed.ok ? parsed.data : null, response.status);
    const retryable = response.status >= 500 || response.status === 429;
    throw new SessionTransportError(message, code, response.status, retryable, parsed.ok ? parsed.data : undefined);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const parsed = await safeParseJson(response);
  if (!parsed.ok) {
    throw new SessionTransportError("Resposta inválida do servidor.", "invalid_response", response.status, false);
  }

  if (requireCurrentContext && !isContextCurrent(captured)) {
    throw new SessionTransportError(
      "Contexto de sessão alterado durante a leitura da resposta.",
      "stale_context",
      0,
      false,
    );
  }

  return parsed.data as TResponse;
}

/** Executa uma operação do plano de controle de sessão (`POST /api/sessions/v1/:operation`). */
export function postSessionOperation<TResponse, TPayload = Record<string, unknown>>(
  operation: SessionOperation,
  payload?: TPayload,
  options: TransportRequestOptions = {},
): Promise<TResponse> {
  return postOperation<TResponse, TPayload>(SESSION_API_BASE_PATH, operation, payload, options, false);
}

/** Executa uma operação de dados autenticados (`POST /api/data/v1/:operation`). */
export function postDataOperation<TResponse, TPayload = Record<string, unknown>>(
  operation: string,
  payload?: TPayload,
  options: TransportRequestOptions = {},
): Promise<TResponse> {
  return postOperation<TResponse, TPayload>(DATA_API_BASE_PATH, operation, payload, options, true);
}
