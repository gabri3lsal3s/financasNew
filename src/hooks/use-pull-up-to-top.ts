import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  computePullDistance,
  evaluatePullIntent,
  isAtScrollBottom,
  PULL_TO_TOP_THRESHOLD_PX,
} from "@/domain/gestures/overscroll";
import { triggerHaptic } from "@/services/haptics";

/** Estado da máquina de estados do gesto (F26 — DoD). */
export type PullUpState = "idle" | "at_bottom" | "pulling" | "threshold_reached" | "triggered" | "cancelled";

export interface UsePullUpToTopOptions {
  /** Função de rolagem até o topo — injetável nos testes (default: scrollTo suave). */
  scrollToTop?: () => void;
  /** Desliga o gesto (ex.: telas com conteúdo próprio não rolável). */
  disabled?: boolean;
}

export interface UsePullUpToTopReturn {
  /** Estado atual da FSM (para o indicador e testes). */
  state: PullUpState;
  /** Progresso do pull (0–1) — para o anel de progresso do indicador. */
  progress: number;
  /** Distância puxada atual (px, pós-resistência) — para o indicador. */
  pullDistance: number;
  /** Handlers de pointer para espalhar no contêiner `main`. */
  pointerHandlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  };
}

/**
 * Engine gestual de Pull-up / Overscroll to Top (F26).
 *
 * FSM: `idle → at_bottom → pulling → threshold_reached → triggered | cancelled`.
 *
 * Barreira de inércia de dois tempos: o overscroll SÓ acumula quando o
 * contêiner já está em repouso estático no fim (`scrollTop + clientHeight >=
 * scrollHeight - 2px`) — flings rápidos que batem no rodapé durante o momentum
 * são ignorados (precisam de um segundo toque estático intencional).
 *
 * Cancelamento reversível: recuar o dedo antes do `touchend` desfaz o threshold
 * em tempo real (o estado volta para `pulling` e o progresso cai); a rolagem
 * suave ao topo dispara estritamente no pointerup com o threshold sustentado.
 *
 * Only `touch`/`pen` (mouse desabilitado — desktop usa Home/PgUp/scrollbar).
 */
export function usePullUpToTop({
  scrollToTop,
  disabled = false,
}: UsePullUpToTopOptions = {}): UsePullUpToTopReturn {
  const [state, setState] = useState<PullUpState>("idle");
  const [progress, setProgress] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  const gestureRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    container: HTMLElement | null;
  } | null>(null);
  const triggeredRef = useRef(false);

  const readContainer = useCallback((event: ReactPointerEvent<HTMLElement>): HTMLElement | null => {
    const el = event.currentTarget;
    return el instanceof HTMLElement ? el : null;
  }, []);

  const handleScrollToTop = useCallback(() => {
    if (scrollToTop) {
      scrollToTop();
      return;
    }
    const main = document.querySelector("main");
    if (main instanceof HTMLElement) {
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      main.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [scrollToTop]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType === "mouse" || !event.isPrimary) return;
      const container = readContainer(event);
      if (!container) return;
      // Conteúdo sem overflow não tem "topo para onde voltar".
      if (container.scrollHeight <= container.clientHeight) return;
      const bottom = isAtScrollBottom(container.scrollTop, container.clientHeight, container.scrollHeight);
      if (!bottom) return; // só engaja no rodapé estático
      gestureRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: performance.now(),
        velocity: 0,
        container,
      };
      triggeredRef.current = false;
      setState("at_bottom");
      // Sem setPointerCapture: o gesto coexiste com o swipe-to-action das
      // linhas (arrasto horizontal mantém dy ~ 0 e desarma o pull-up).
    },
    [disabled, readContainer],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dy = event.clientY - gesture.startY;
    if (dy <= 0) {
      // Recuou para cima: cancela o arrasto acumulado (reversível).
      triggeredRef.current = false;
      setPullDistance(0);
      setProgress(0);
      setState("at_bottom");
      return;
    }
    const container = gesture.container;
    if (!container) return;
    // Barreira de inércia: revalida o repouso no fim a cada movimento —
    // momentum que ainda está rolando desarma o gesto.
    if (!isAtScrollBottom(container.scrollTop, container.clientHeight, container.scrollHeight)) {
      gestureRef.current = null;
      triggeredRef.current = false;
      setPullDistance(0);
      setProgress(0);
      setState("idle");
      return;
    }
    const now = performance.now();
    const dt = Math.max(1, now - gesture.lastTime);
    gesture.velocity = (event.clientY - gesture.lastY) / dt;
    gesture.lastY = event.clientY;
    gesture.lastTime = now;

    const distance = computePullDistance(dy);
    setPullDistance(distance);
    const intent = evaluatePullIntent(distance, PULL_TO_TOP_THRESHOLD_PX, true);
    if (intent === "trigger") {
      setState("threshold_reached");
      if (!triggeredRef.current) {
        triggeredRef.current = true;
        triggerHaptic("light"); // armado
      }
    } else if (intent === "hold") {
      setState("pulling");
    }
    setProgress(Math.min(1, distance / PULL_TO_TOP_THRESHOLD_PX));
    event.preventDefault();
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      // Decisão por ref (nunca closure stale): o threshold sustenta até a
      // soltura se o dedo não recuou nem o contêiner saiu do rodapé.
      if (triggeredRef.current) {
        triggeredRef.current = false;
        setState("triggered");
        handleScrollToTop();
      } else {
        setState("cancelled");
      }
      setPullDistance(0);
      setProgress(0);
      // Volta ao idle após o frame do estado final (feedback visível).
      requestAnimationFrame(() => setState("idle"));
    },
    [handleScrollToTop],
  );

  const onPointerCancel = useCallback(() => {
    gestureRef.current = null;
    triggeredRef.current = false;
    setPullDistance(0);
    setProgress(0);
    setState("cancelled");
    requestAnimationFrame(() => setState("idle"));
  }, []);

  // Cleanup do pointer capture pendente no unmount.
  useEffect(() => {
    return () => {
      gestureRef.current = null;
    };
  }, []);

  return {
    state,
    progress,
    pullDistance,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
