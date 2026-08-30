/**
 * Gateway único de erros (ESPECIFICAÇÃO §1.7 / AGENTS §5 — resiliência).
 *
 * Toda borda (hooks, telas, RPCs) passa o erro cru por aqui:
 *   - classifica em categorias conhecidas (rate limit, sessão, rede…);
 *   - produz mensagem pt-BR padronizada para o usuário;
 *   - preserva o erro original para debug.
 */

export type ErrorKind =
  | "rate-limit"
  | "email-not-confirmed"
  | "invalid-credentials"
  | "session-expired"
  | "duplicate"
  | "foreign-key"
  | "network"
  | "validation"
  | "permission"
  | "unknown";

/** Erro classificado pelo gateway (resultado de classifyError). */
export interface ClassifiedError {
  kind: ErrorKind;
  message: string;
  raw: unknown;
}

/** Erro normalizado do app — relançado pelas bordas (data/, hooks). */
export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly raw: unknown;

  constructor(kind: ErrorKind, message: string, raw?: unknown) {
    super(message);
    this.name = "AppError";
    this.kind = kind;
    this.raw = raw;
  }
}

const MESSAGES: Record<ErrorKind, string> = {
  "rate-limit": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "email-not-confirmed": "E-mail ainda não confirmado. Verifique sua caixa de entrada.",
  "invalid-credentials": "E-mail ou senha incorretos.",
  "session-expired": "Sua sessão expirou. Entre novamente para continuar.",
  duplicate: "Já existe um registro com esses dados.",
  "foreign-key": "Não é possível excluir este registro pois existem lançamentos vinculados a ele. Você pode desativá-lo para manter o histórico.",
  network: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  validation: "Dados inválidos. Revise as informações e tente novamente.",
  permission: "Acesso negado. Você não possui permissão para realizar esta operação ou seu período de teste encerrou.",
  unknown: "Algo deu errado. Tente novamente em instantes.",
};

function hasStatus(error: unknown): error is { status?: number | string } {
  return typeof error === "object" && error !== null && "status" in error;
}

function hasCode(error: unknown): error is { code?: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

function hasMessage(error: unknown): error is { message?: string } {
  return typeof error === "object" && error !== null && "message" in error;
}

const isNetworkError = (error: unknown): boolean => {
  if (!hasMessage(error)) return false;
  const msg = error.message ?? "";
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg);
};

/** Classifica o erro cru em uma categoria conhecida. */
export function classifyError(error: unknown): ClassifiedError {
  if (isNetworkError(error)) {
    return { kind: "network", message: MESSAGES.network, raw: error };
  }

  const status = hasStatus(error) ? Number(error.status) : undefined;
  const code = hasCode(error) ? (error.code ?? "").toLowerCase() : "";
  const message = hasMessage(error) ? (error.message ?? "") : "";

  if (status === 429 || code.includes("rate_limit") || /rate limit/i.test(message)) {
    return { kind: "rate-limit", message: MESSAGES["rate-limit"], raw: error };
  }
  if (status === 422 || code.includes("email_not_confirmed") || /email not confirmed/i.test(message)) {
    return { kind: "email-not-confirmed", message: MESSAGES["email-not-confirmed"], raw: error };
  }
  if (code.includes("invalid_credentials") || /invalid login credentials|invalid credentials/i.test(message)) {
    return { kind: "invalid-credentials", message: MESSAGES["invalid-credentials"], raw: error };
  }
  if (status === 401 || code === "pgrst301" || code.includes("jwt") || code.includes("session_expired") || /session expired/i.test(message)) {
    return { kind: "session-expired", message: MESSAGES["session-expired"], raw: error };
  }
  if (code === "23505" || code.includes("duplicate") || /duplicate key|unique constraint/i.test(message)) {
    return { kind: "duplicate", message: MESSAGES.duplicate, raw: error };
  }
  if (code === "23503" || code.includes("foreign_key") || /foreign key|foreign_key|violates foreign key/i.test(message)) {
    return { kind: "foreign-key", message: MESSAGES["foreign-key"], raw: error };
  }
  if (code === "23514" || code.includes("check_violation") || /check constraint|check_violation/i.test(message)) {
    return { kind: "validation", message: MESSAGES.validation, raw: error };
  }
  if (
    status === 403 ||
    code === "42501" ||
    code.includes("permission_denied") ||
    /row-level security|insufficient privilege|permissão negada|acesso negado/i.test(message)
  ) {
    const isCustomPtBr = /acesso negado|permissão/i.test(message);
    return {
      kind: "permission",
      message: isCustomPtBr ? message : MESSAGES.permission,
      raw: error,
    };
  }

  // Mensagens de negócio lançadas pelos RPCs (raise exception) já chegam em
  // pt-BR — repassar a mensagem original quando não há categoria conhecida.
  if (typeof message === "string" && message.length > 0) {
    return { kind: "unknown", message, raw: error };
  }
  return { kind: "unknown", message: MESSAGES.unknown, raw: error };
}

/** Mensagem pt-BR padronizada para exibição ao usuário. */
export function getErrorMessage(error: unknown): string {
  return classifyError(error).message;
}
