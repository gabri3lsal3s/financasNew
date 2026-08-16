/**
 * Bus de toasts imperativos (módulo-level pub/sub).
 *
 * O `Toast` do app (Radix) é declarativo e montado no shell; mutações
 * otimistas (ex.: rollback em `onError`) precisam notificar fora da árvore
 * React — este bus permite `pushToast(...)` de qualquer camada, com o
 * `ToastHost` (`components/ui/toast-host.tsx`) como assinante único,
 * montado dentro do `Toaster` (providers).
 *
 * Padrão: estado module-level + listeners — sem contexto, sem re-render do
 * app; inspirado no `services/haptics.ts` (no-op seguro em qualquer ambiente).
 */

import type { ToastVariant } from "@/components/ui/toast";

export interface ToastRequest {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Duração em ms (padrão do Toast: 4000). */
  duration?: number;
}

export interface ToastItem extends Required<Pick<ToastRequest, "title" | "variant">> {
  id: number;
  description?: string;
  duration: number;
}

type ToastListener = (items: ToastItem[]) => void;

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<ToastListener>();

/** Notifica todos os assinantes (immer-free: sempre um novo array). */
function emit(): void {
  const snapshot = items;
  for (const listener of listeners) listener(snapshot);
}

/** Dispara um toast global (ex.: rollback de atualização otimista). */
export function pushToast(request: ToastRequest): number {
  const id = nextId++;
  const item: ToastItem = {
    id,
    title: request.title,
    description: request.description,
    variant: request.variant ?? "default",
    duration: request.duration ?? 4000,
  };
  items = [...items, item];
  emit();
  return id;
}

/** Remove um toast pelo id (disparado pelo fechamento/auto-dismiss). */
export function dismissToast(id: number): void {
  if (!items.some((item) => item.id === id)) return;
  items = items.filter((item) => item.id !== id);
  emit();
}

/** Remove todos os toasts (limpeza de estado module-level em testes). */
export function clearToasts(): void {
  if (items.length === 0) return;
  items = [];
  emit();
}

/** Inscreve um listener (o ToastHost) — retorna o unsubscribe. */
export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
