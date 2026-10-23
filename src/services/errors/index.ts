/**
 * Gateway único de erros (ESPECIFICAÇÃO §1.7 / AGENTS §5 — resiliência).
 *
 * Toda borda (hooks, telas, RPCs) passa o erro cru por aqui:
 *   - classifica em categorias conhecidas (rate limit, sessão, rede…);
 *   - produz mensagem pt-BR padronizada para o usuário;
 *   - preserva o erro original para debug.
 */

import { sanitizeString } from "@/domain/validation";

export type ErrorKind =
  | "rate-limit"
  | "service-unavailable"
  | "email-not-confirmed"
  | "user-already-exists"
  | "user_already_exists"
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

export const MESSAGES: Record<ErrorKind, string> = {
  "rate-limit": "Muitas requisições simultâneas. Aguarde alguns instantes e tente novamente.",
  "service-unavailable": "Serviço temporariamente indisponível para manutenção. Aguarde alguns instantes e tente novamente.",
  "email-not-confirmed": "E-mail ainda não confirmado. Verifique sua caixa de entrada.",
  "user-already-exists":
    "Este e-mail já está cadastrado no Áxis Finance. Faça login ou recupere sua senha se tiver esquecido.",
  user_already_exists:
    "Este e-mail já está cadastrado no Áxis Finance. Faça login ou recupere sua senha se tiver esquecido.",
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

function hasDetails(error: unknown): error is { details?: string } {
  return typeof error === "object" && error !== null && "details" in error;
}

function hasHint(error: unknown): error is { hint?: string } {
  return typeof error === "object" && error !== null && "hint" in error;
}

const isNetworkError = (error: unknown): boolean => {
  if (!hasMessage(error)) return false;
  const msg = error.message ?? "";
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg);
};

/**
 * Padrões de mensagens técnicas internas (Postgres, Node, JS runtime, PostgREST) que
 * NUNCA devem vazar detalhes de esquema, SQL, nomes de colunas, procedures ou stack traces para o usuário final.
 */
const TECHNICAL_LEAK_PATTERNS = [
  // Nomes de colunas, tabelas, relations e constraints
  /relation\s+["']?[a-zA-Z0-9_.]+["']?/i,
  /column\s+["']?[a-zA-Z0-9_.]+["']?/i,
  /table\s+["']?[a-zA-Z0-9_.]+["']?/i,
  /constraint\s+["']?[a-zA-Z0-9_.]+["']?/i,
  /syntax\s+error\s+at\s+or\s+near/i,
  /operator\s+does\s+not\s+exist/i,
  /null\s+value\s+in\s+column/i,
  /violates\s+(?:not-null|check|unique|foreign\s+key)\s+constraint/i,
  /invalid\s+input\s+syntax\s+for/i,
  /key\s*\([^)]*\)\s*=(?:\s*\([^)]*\))?\s*(?:already\s+exists|is\s+still\s+referenced)/i,
  /deadlock\s+detected/i,
  /lock\s+not\s+available/i,
  /could\s+not\s+connect/i,
  /connection\s+refused/i,
  /connection\s+to\s+server\s+was\s+lost/i,
  /query\s+canceled/i,
  /statement\s+timeout/i,
  /postgrest/i,
  /\bpgrst\d+/i,
  /\bsqlstate\b/i,
  /\bplpgsql\b/i,
  /\bsearch_path\b/i,
  /\bpg_temp\b/i,
  /\bpg_catalog\b/i,
  /\binformation_schema\b/i,
  /\bSELECT\s+.*?\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+.*?\s+SET\b/i,
  /\bDELETE\s+FROM\b/i,

  // Nomes de procedures, funções e RPCs internas
  /function\s+["']?[a-zA-Z0-9_.]+["']?\s*(?:does\s+not\s+exist|\(.*?\))/i,
  /procedure\s+["']?[a-zA-Z0-9_.]+["']?/i,
  /public\.[a-zA-Z0-9_]+\s*\(/i,
  /\brpc\s+[a-zA-Z0-9_]+/i,

  // Stack traces e Erros de Runtime JS/Node
  /\bat\s+(?:async\s+)?[a-zA-Z0-9_.<>$]+\s+\([^)]+:\d+:\d+\)/i,
  /\bat\s+(?:node:|file:\/\/|\/|[a-zA-Z]:\\)/i,
  /\b(?:TypeError|ReferenceError|RangeError|SyntaxError|URIError|EvalError):\s+/i,
  /cannot\s+read\s+propert(?:y|ies)\s+of\s+(?:undefined|null)/i,
  /(?:node_modules|src\/|supabase\/functions\/)/i,
];

function containsTechnicalLeak(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return TECHNICAL_LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

/** Classifica o erro cru em uma categoria conhecida. */
export function classifyError(error: unknown): ClassifiedError {
  if (isNetworkError(error)) {
    return { kind: "network", message: MESSAGES.network, raw: error };
  }

  const status = hasStatus(error) ? Number(error.status) : undefined;
  const code = hasCode(error) ? (error.code ?? "").toLowerCase() : "";
  const message = hasMessage(error) ? (error.message ?? "") : "";
  const details = hasDetails(error) && typeof error.details === "string" ? error.details : "";
  const hint = hasHint(error) && typeof error.hint === "string" ? error.hint : "";

  if (status === 429 || code.includes("rate_limit") || /rate limit|too many requests/i.test(message)) {
    return { kind: "rate-limit", message: MESSAGES["rate-limit"], raw: error };
  }
  if (
    status === 503 ||
    code === "503" ||
    code.includes("service_unavailable") ||
    /service unavailable|503|manutenção/i.test(message)
  ) {
    return { kind: "service-unavailable", message: MESSAGES["service-unavailable"], raw: error };
  }
  if (
    code.includes("user_already_exists") ||
    code.includes("user-already-exists") ||
    /user already registered|user_already_exists|email_exists|user already exists/i.test(message) ||
    ((status === 422 || code === "422") &&
      /user|registered|already|cadastrado/i.test(message))
  ) {
    return { kind: "user-already-exists", message: MESSAGES["user-already-exists"], raw: error };
  }
  if (
    code.includes("email_not_confirmed") ||
    /email not confirmed/i.test(message) ||
    (status === 422 && !/login|credential/i.test(message))
  ) {
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
    const cleanMsg = isCustomPtBr && !containsTechnicalLeak(message) ? sanitizeString(message) : MESSAGES.permission;
    return {
      kind: "permission",
      message: cleanMsg,
      raw: error,
    };
  }

  // Se a mensagem contém vazamento técnico de banco, SQL, procedures, colunas ou runtime, protege o usuário com a mensagem genérica segura.
  if (containsTechnicalLeak(message) || containsTechnicalLeak(details) || containsTechnicalLeak(hint)) {
    return { kind: "unknown", message: MESSAGES.unknown, raw: error };
  }

  // Mensagens de negócio lançadas pelos RPCs (raise exception) já chegam em
  // pt-BR — repassar a mensagem sanitizada quando não há categoria conhecida.
  if (typeof message === "string" && message.length > 0) {
    return { kind: "unknown", message: sanitizeString(message), raw: error };
  }
  return { kind: "unknown", message: MESSAGES.unknown, raw: error };
}

/** Mensagem pt-BR padronizada para exibição ao usuário. */
export function getErrorMessage(error: unknown): string {
  return classifyError(error).message;
}
