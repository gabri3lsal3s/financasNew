/**
 * Gerenciador de contexto de sessão da aba por geração (T04).
 *
 * Mantém metadados públicos do contexto ativo (contextId, csrfToken, generation,
 * accountRef, mode) sem armazenar credenciais Supabase no navegador.
 * Permite capturar um snapshot antes de operações assíncronas para descartar
 * respostas tardias após troca de conta ou logout, além de registrar revalidação
 * quando a aba retorna do BFCache (`pageshow` com `persisted: true`).
 */

import type {
  PublicSessionContext,
  SessionContextStatus,
  SessionMode,
} from "@/types/session-custody";

export interface TabSessionContext {
  status: SessionContextStatus;
  contextId: string | null;
  csrfToken: string | null;
  generation: number;
  revision: number;
  environment: string;
  mode: SessionMode;
  accountRef: string | null;
  displayName: string | null;
  expiresAt: number | null;
  mfaFactorId: string | null;
  pendingRevocations: number;
}

export interface CapturedSessionContext {
  contextId: string | null;
  accountRef: string | null;
  generation: number;
  revision: number;
  mode: SessionMode;
  epoch: number;
}

export type SessionContextListener = (context: TabSessionContext) => void;
export type BfCacheRevalidateHandler = (context: TabSessionContext) => void | Promise<void>;
export type BfCacheEventTarget = Pick<Window, "addEventListener" | "removeEventListener">;

const INITIAL_SESSION_CONTEXT: TabSessionContext = {
  status: "neutral",
  contextId: null,
  csrfToken: null,
  generation: 0,
  revision: 0,
  environment: "production",
  mode: "personal",
  accountRef: null,
  displayName: null,
  expiresAt: null,
  mfaFactorId: null,
  pendingRevocations: 0,
};

let currentContext: TabSessionContext = { ...INITIAL_SESSION_CONTEXT };
let contextEpoch = 0;
const contextListeners = new Set<SessionContextListener>();

function notifyListeners(): void {
  const snapshot = getSessionContext();
  contextListeners.forEach((listener) => listener(snapshot));
}

/** Retorna uma cópia imutável do contexto de sessão atual da aba. */
export function getSessionContext(): TabSessionContext {
  return { ...currentContext };
}

/**
 * Aplica um novo contexto público de sessão recebido do backend.
 * Incrementa a época local sempre que a identidade, geração, modo ou status mudam,
 * invalidando imediatamente qualquer operação em voo capturada anteriormente.
 */
export function setSessionContext(next: PublicSessionContext): TabSessionContext {
  const normalized: TabSessionContext = {
    status: next.status,
    contextId: next.contextId,
    csrfToken: next.csrfToken,
    generation: next.generation,
    revision: next.revision,
    environment: next.environment,
    mode: next.mode,
    accountRef: next.accountRef,
    displayName: next.displayName,
    expiresAt: next.expiresAt,
    mfaFactorId: next.mfaFactorId ?? null,
    pendingRevocations: next.pendingRevocations ?? 0,
  };

  const identityChanged =
    normalized.contextId !== currentContext.contextId ||
    normalized.accountRef !== currentContext.accountRef ||
    normalized.generation !== currentContext.generation ||
    normalized.mode !== currentContext.mode ||
    normalized.status !== currentContext.status;

  if (identityChanged) {
    contextEpoch += 1;
  }

  currentContext = normalized;
  notifyListeners();
  return getSessionContext();
}

/**
 * Limpa o contexto ativo da aba (logout, revogação, expiração ou bloqueio),
 * avançando geração e época local para descartar respostas tardias em voo.
 */
export function clearSessionContext(
  status: Extract<SessionContextStatus, "neutral" | "locked" | "revoked" | "expired"> = "neutral",
): TabSessionContext {
  contextEpoch += 1;
  currentContext = {
    ...INITIAL_SESSION_CONTEXT,
    status,
    environment: currentContext.environment,
    generation: currentContext.generation + 1,
  };
  notifyListeners();
  return getSessionContext();
}

/** Captura o marcador do contexto atual antes de iniciar uma operação assíncrona. */
export function captureContext(): CapturedSessionContext {
  return {
    contextId: currentContext.contextId,
    accountRef: currentContext.accountRef,
    generation: currentContext.generation,
    revision: currentContext.revision,
    mode: currentContext.mode,
    epoch: contextEpoch,
  };
}

/**
 * Verifica se um contexto previamente capturado ainda corresponde ao contexto
 * ativo da aba. Retorna `false` após troca de conta, logout ou mudança de geração.
 */
export function isContextCurrent(captured: CapturedSessionContext): boolean {
  return (
    captured.epoch === contextEpoch &&
    captured.contextId === currentContext.contextId &&
    captured.accountRef === currentContext.accountRef &&
    captured.generation === currentContext.generation &&
    captured.mode === currentContext.mode
  );
}

/** Inscreve um ouvinte para mudanças no contexto de sessão da aba. */
export function subscribeSessionContext(listener: SessionContextListener): () => void {
  contextListeners.add(listener);
  return () => {
    contextListeners.delete(listener);
  };
}

/**
 * Registra o listener de BFCache (`pageshow` com `event.persisted === true`)
 * para disparar revalidação imediata do contexto ao restaurar a página do cache.
 */
export function registerBfCacheRevalidation(
  onRevalidate: BfCacheRevalidateHandler,
  target: BfCacheEventTarget | null = typeof window !== "undefined" ? window : null,
): () => void {
  if (!target) {
    return () => {};
  }

  const handlePageShow = (event: Event): void => {
    const persisted = "persisted" in event && Boolean((event as PageTransitionEvent).persisted);
    if (!persisted) return;
    void onRevalidate(getSessionContext());
  };

  target.addEventListener("pageshow", handlePageShow);
  return () => {
    target.removeEventListener("pageshow", handlePageShow);
  };
}

/** Reseta completamente o estado em memória do contexto (exclusivo para testes). */
export function resetSessionContextForTests(): void {
  currentContext = { ...INITIAL_SESSION_CONTEXT };
  contextEpoch = 0;
  contextListeners.clear();
}
