import { useCallback, useState, useSyncExternalStore } from "react";
import type {
  AccountSummary,
  LogoutResult,
  OpenTabIntentResult,
  PublicSessionContext,
} from "@/types/session-custody";
import {
  isSessionTransportError,
  postSessionOperation,
  type SessionTransportErrorCode,
} from "@/data/session-transport";
import {
  captureContext,
  clearSessionContext,
  getSessionContext,
  isContextCurrent,
  setSessionContext,
  subscribeSessionContext,
  type TabSessionContext,
} from "@/services/session-context";
import { getErrorMessage } from "@/services/errors";

export type AccountSwitcherAction =
  | "list"
  | "switch"
  | "open-tab"
  | "logout"
  | "logout-device"
  | "forget";

export type AccountSwitcherResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: SessionTransportErrorCode; message: string };

export interface SwitchAccountParams {
  accountRef: string;
  expectedGeneration: number;
  localLockProof?: string;
  signal?: AbortSignal;
}

export interface OpenTabParams {
  accountRef: string;
  expectedGeneration?: number;
  targetPath?: string;
  signal?: AbortSignal;
}

export interface LogoutAccountParams {
  remember?: boolean;
  scope?: "tab" | "device";
  signal?: AbortSignal;
}

export interface ForgetAccountParams {
  accountRef: string;
  signal?: AbortSignal;
}

export interface UseAccountSwitcherReturn {
  context: TabSessionContext;
  accounts: AccountSummary[];
  loading: boolean;
  busyAction: AccountSwitcherAction | null;
  error: string | null;
  errorCode: SessionTransportErrorCode | null;
  lastLogoutResult: LogoutResult | null;
  clearError: () => void;
  listAccounts: (options?: { signal?: AbortSignal }) => Promise<AccountSwitcherResult<{ accounts: AccountSummary[] }>>;
  switchAccount: (params: SwitchAccountParams) => Promise<AccountSwitcherResult<{ context: PublicSessionContext }>>;
  openTab: (params: OpenTabParams) => Promise<AccountSwitcherResult<{ intent: OpenTabIntentResult }>>;
  logout: (params?: LogoutAccountParams) => Promise<AccountSwitcherResult<{ result: LogoutResult }>>;
  logoutDevice: (options?: { signal?: AbortSignal }) => Promise<AccountSwitcherResult<{ result: LogoutResult }>>;
  forgetAccount: (params: ForgetAccountParams) => Promise<AccountSwitcherResult<{ accountRef: string }>>;
}

const SESSION_ERROR_MESSAGES: Record<SessionTransportErrorCode, string> = {
  unauthorized: "Sua sessão não está mais autorizada. Faça login novamente.",
  context_stale: "A sessão mudou em outra operação. Atualize a lista de contas e tente novamente.",
  stale_context: "A conta ativa mudou durante a operação. Tente novamente.",
  step_up_required: "Confirmação adicional de segurança necessária para concluir esta ação.",
  limit_reached: "Limite máximo de 5 contas pessoais atingido neste dispositivo.",
  service_unavailable: "Serviço de sessões temporariamente indisponível. Tente novamente.",
  invalid_payload: "Dados inválidos para esta operação de conta.",
  invalid_origin: "Origem da requisição não autorizada.",
  forbidden_host: "Operação não permitida neste endereço.",
  network_error: "Sem conexão com o servidor. Verifique sua rede e tente novamente.",
  invalid_response: "Resposta inesperada do servidor de sessões.",
};

export function mapSessionError(error: unknown): { code: SessionTransportErrorCode; message: string } {
  if (isSessionTransportError(error)) {
    const mappedMessage = SESSION_ERROR_MESSAGES[error.code] ?? error.message;
    return {
      code: error.code,
      message: mappedMessage,
    };
  }
  return {
    code: "service_unavailable",
    message: getErrorMessage(error),
  };
}

function filterVisibleAccounts(raw: unknown): AccountSummary[] {
  const list = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === "object" && Array.isArray((raw as { accounts?: unknown }).accounts)
      ? (raw as { accounts: unknown[] }).accounts
      : [];

  return list.filter((item): item is AccountSummary => {
    if (item === null || typeof item !== "object") return false;
    const candidate = item as Partial<AccountSummary>;
    if (typeof candidate.accountRef !== "string" || candidate.accountRef.trim() === "") return false;
    if (candidate.mode === "operator") return false;
    return true;
  });
}

function extractPublicContext(raw: unknown): PublicSessionContext | null {
  if (raw === null || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.context && typeof record.context === "object") {
    return record.context as PublicSessionContext;
  }
  if (typeof record.status === "string" && typeof record.generation === "number") {
    return raw as PublicSessionContext;
  }
  return null;
}

function extractLogoutResult(raw: unknown): LogoutResult {
  if (raw !== null && typeof raw === "object") {
    const record = raw as Partial<LogoutResult>;
    return {
      status: "neutral",
      upstreamConfirmed: Boolean(record.upstreamConfirmed),
      pendingRevocations: typeof record.pendingRevocations === "number" ? record.pendingRevocations : 0,
    };
  }
  return {
    status: "neutral",
    upstreamConfirmed: false,
    pendingRevocations: 0,
  };
}

/**
 * Encapsula listagem, troca com expectedGeneration, abertura em nova aba,
 * logout (com remember estritamente opt-in), logout do dispositivo e esquecimento de conta
 * exclusivamente via BFF (`session-transport`) e contexto reativo (`session-context`).
 */
let cachedContextSnapshot: TabSessionContext | null = null;

function getCachedSessionContext(): TabSessionContext {
  const next = getSessionContext();
  if (
    cachedContextSnapshot !== null &&
    cachedContextSnapshot.status === next.status &&
    cachedContextSnapshot.contextId === next.contextId &&
    cachedContextSnapshot.csrfToken === next.csrfToken &&
    cachedContextSnapshot.generation === next.generation &&
    cachedContextSnapshot.revision === next.revision &&
    cachedContextSnapshot.environment === next.environment &&
    cachedContextSnapshot.mode === next.mode &&
    cachedContextSnapshot.accountRef === next.accountRef &&
    cachedContextSnapshot.displayName === next.displayName &&
    cachedContextSnapshot.expiresAt === next.expiresAt &&
    cachedContextSnapshot.mfaFactorId === next.mfaFactorId &&
    cachedContextSnapshot.pendingRevocations === next.pendingRevocations
  ) {
    return cachedContextSnapshot;
  }
  cachedContextSnapshot = next;
  return cachedContextSnapshot;
}

export function useAccountSwitcher(): UseAccountSwitcherReturn {
  const context = useSyncExternalStore(
    subscribeSessionContext,
    getCachedSessionContext,
    getCachedSessionContext,
  );
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<AccountSwitcherAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<SessionTransportErrorCode | null>(null);
  const [lastLogoutResult, setLastLogoutResult] = useState<LogoutResult | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const listAccounts = useCallback(
    async (options?: { signal?: AbortSignal }): Promise<AccountSwitcherResult<{ accounts: AccountSummary[] }>> => {
      const captured = captureContext();
      setLoading(true);
      setBusyAction("list");
      setError(null);
      setErrorCode(null);
      try {
        const response = await postSessionOperation<{ accounts: AccountSummary[] } | AccountSummary[]>(
          "accounts",
          {},
          { signal: options?.signal },
        );
        const visible = filterVisibleAccounts(response);
        if (!isContextCurrent(captured)) {
          return {
            ok: false,
            code: "stale_context",
            message: SESSION_ERROR_MESSAGES.stale_context,
          };
        }
        setAccounts(visible);
        return { ok: true, accounts: visible };
      } catch (err) {
        const mapped = mapSessionError(err);
        if (isContextCurrent(captured)) {
          setError(mapped.message);
          setErrorCode(mapped.code);
        }
        return { ok: false, ...mapped };
      } finally {
        setLoading(false);
        setBusyAction((current) => (current === "list" ? null : current));
      }
    },
    [],
  );

  const switchAccount = useCallback(
    async (params: SwitchAccountParams): Promise<AccountSwitcherResult<{ context: PublicSessionContext }>> => {
      setBusyAction("switch");
      setError(null);
      setErrorCode(null);
      try {
        const payload: Record<string, unknown> = {
          accountRef: params.accountRef,
          expectedGeneration: params.expectedGeneration,
        };
        if (params.localLockProof) {
          payload.localLockProof = params.localLockProof;
        }
        const response = await postSessionOperation<PublicSessionContext | { context: PublicSessionContext }>(
          "switch",
          payload,
          { signal: params.signal },
        );
        const nextContext = extractPublicContext(response);
        if (!nextContext) {
          const message = SESSION_ERROR_MESSAGES.invalid_response;
          setError(message);
          setErrorCode("invalid_response");
          return { ok: false, code: "invalid_response", message };
        }
        setSessionContext(nextContext);
        setAccounts((prev) =>
          prev.map((item) => {
            if (item.accountRef === nextContext.accountRef) {
              return { ...item, status: "active", generation: nextContext.generation };
            }
            if (item.status === "active") {
              return { ...item, status: "remembered" };
            }
            return item;
          }),
        );
        return { ok: true, context: nextContext };
      } catch (err) {
        const mapped = mapSessionError(err);
        setError(mapped.message);
        setErrorCode(mapped.code);
        return { ok: false, ...mapped };
      } finally {
        setBusyAction((current) => (current === "switch" ? null : current));
      }
    },
    [],
  );

  const openTab = useCallback(
    async (params: OpenTabParams): Promise<AccountSwitcherResult<{ intent: OpenTabIntentResult }>> => {
      setBusyAction("open-tab");
      setError(null);
      setErrorCode(null);
      try {
        const payload: Record<string, unknown> = {
          accountRef: params.accountRef,
        };
        if (params.expectedGeneration !== undefined) {
          payload.expectedGeneration = params.expectedGeneration;
        }
        if (params.targetPath) {
          payload.targetPath = params.targetPath;
        }
        const intent = await postSessionOperation<OpenTabIntentResult>("open-tab", payload, {
          signal: params.signal,
        });
        return { ok: true, intent };
      } catch (err) {
        const mapped = mapSessionError(err);
        setError(mapped.message);
        setErrorCode(mapped.code);
        return { ok: false, ...mapped };
      } finally {
        setBusyAction((current) => (current === "open-tab" ? null : current));
      }
    },
    [],
  );

  const logout = useCallback(
    async (params?: LogoutAccountParams): Promise<AccountSwitcherResult<{ result: LogoutResult }>> => {
      const remember = params?.remember === true;
      const activeRef = getSessionContext().accountRef;
      setBusyAction("logout");
      setError(null);
      setErrorCode(null);
      try {
        const payload: Record<string, unknown> = { remember };
        if (params?.scope) {
          payload.scope = params.scope;
        }
        const raw = await postSessionOperation<LogoutResult>("logout", payload, {
          signal: params?.signal,
        });
        const result = extractLogoutResult(raw);
        clearSessionContext("neutral");
        setLastLogoutResult(result);
        setAccounts((prev) => {
          if (!activeRef) return prev;
          if (remember) {
            return prev.map((item) =>
              item.accountRef === activeRef ? { ...item, status: "remembered" } : item,
            );
          }
          return prev.filter((item) => item.accountRef !== activeRef);
        });
        return { ok: true, result };
      } catch (err) {
        const mapped = mapSessionError(err);
        setError(mapped.message);
        setErrorCode(mapped.code);
        return { ok: false, ...mapped };
      } finally {
        setBusyAction((current) => (current === "logout" ? null : current));
      }
    },
    [],
  );

  const logoutDevice = useCallback(
    async (options?: { signal?: AbortSignal }): Promise<AccountSwitcherResult<{ result: LogoutResult }>> => {
      setBusyAction("logout-device");
      setError(null);
      setErrorCode(null);
      try {
        const raw = await postSessionOperation<LogoutResult>("logout-device", {}, {
          signal: options?.signal,
        });
        const result = extractLogoutResult(raw);
        clearSessionContext("neutral");
        setLastLogoutResult(result);
        setAccounts([]);
        return { ok: true, result };
      } catch (err) {
        const mapped = mapSessionError(err);
        setError(mapped.message);
        setErrorCode(mapped.code);
        return { ok: false, ...mapped };
      } finally {
        setBusyAction((current) => (current === "logout-device" ? null : current));
      }
    },
    [],
  );

  const forgetAccount = useCallback(
    async (params: ForgetAccountParams): Promise<AccountSwitcherResult<{ accountRef: string }>> => {
      setBusyAction("forget");
      setError(null);
      setErrorCode(null);
      try {
        await postSessionOperation<Record<string, unknown>>(
          "forget",
          { accountRef: params.accountRef },
          { signal: params.signal },
        );
        const activeRef = getSessionContext().accountRef;
        if (activeRef && activeRef === params.accountRef) {
          clearSessionContext("neutral");
        }
        setAccounts((prev) => prev.filter((item) => item.accountRef !== params.accountRef));
        return { ok: true, accountRef: params.accountRef };
      } catch (err) {
        const mapped = mapSessionError(err);
        setError(mapped.message);
        setErrorCode(mapped.code);
        return { ok: false, ...mapped };
      } finally {
        setBusyAction((current) => (current === "forget" ? null : current));
      }
    },
    [],
  );

  return {
    context,
    accounts,
    loading,
    busyAction,
    error,
    errorCode,
    lastLogoutResult,
    clearError,
    listAccounts,
    switchAccount,
    openTab,
    logout,
    logoutDevice,
    forgetAccount,
  };
}
