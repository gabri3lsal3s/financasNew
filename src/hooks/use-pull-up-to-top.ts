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
 * Confiabilidade (F26 evolução — gesto instável/aleatório corrigido):
 *   • **Âncora no meio do gesto:** o engajamento não depende do `pointerdown`
 *     estar no rodapé — se o usuário atinge o fim do scroll DURANTE o
 *     `pointermove`, a âncora `startY` é re-registrada naquele instante e o
 *     pull passa a contar dali (rolar até o fim e puxar num mesmo gesto);
 *   • **Subpixel:** fim de scroll detectado com `Math.ceil` + tolerância 8px
 *     (telas DPI alto reportam `scrollTop` fracionário);
 *   • **Overscroll nativo:** o contêiner recebe `overscroll-behavior-y: contain`
 *     e um listener nativo `touchmove` **não-passivo** no `pointerdown`
 *     (`currentTarget`), removido ao fim do gesto — `preventDefault()` só é
 *     chamado quando engajado puxando para baixo, então o navegador não
 *     compete pelo toque nem encadeia o scroll no `body`.
 *
 * Barreira de inércia: o overscroll SÓ acumula quando o contêiner está em
 * repouso estático no fim — flings rápidos que batem no rodapé durante o
 * momentum são ignorados (precisam de um segundo toque estático intencional).
 *
 * Cancelamento reversível: recuar o dedo antes do `touchend` desfaz o
 * threshold em tempo real; a rolagem suave ao topo dispara estritamente no
 * `pointerup` com o threshold sustentado.
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
    /** O gesto acumula pull? (engaja ao chegar no rodapé — pointerdown ou no meio do move). */
    engaged: boolean;
    container: HTMLElement | null;
  } | null>(null);
  const triggeredRef = useRef(false);
  /** Contêiner com o listener nativo `touchmove` não-passivo anexado. */
  const nativeContainerRef = useRef<HTMLElement | null>(null);

  const readContainer = useCallback((event: ReactPointerEvent<HTMLElement>): HTMLElement | null => {
    const el = event.currentTarget;
    return el instanceof HTMLElement ? el : null;
  }, []);

  const isAtBottomOf = useCallback((container: HTMLElement): boolean => {
    return isAtScrollBottom(container.scrollTop, container.clientHeight, container.scrollHeight);
  }, []);

  const handleScrollToTop = useCallback(
    (container: HTMLElement | null) => {
      if (scrollToTop) {
        scrollToTop();
        return;
      }
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
      if (container) {
        container.scrollTo({ top: 0, behavior });
        return;
      }
      const main = document.querySelector("main");
      if (main instanceof HTMLElement) {
        main.scrollTo({ top: 0, behavior });
      } else {
        window.scrollTo({ top: 0, behavior });
      }
    },
    [scrollToTop],
  );

  /** Listener nativo: previne o overscroll apenas quando engajado puxando para baixo. */
  const onNativeTouchMove = useCallback((event: Event) => {
    const gesture = gestureRef.current;
    if (!gesture || !gesture.engaged) return;
    const touch = (event as TouchEvent).touches?.[0];
    if (!touch) return;
    // Puxando além do rodapé (dy > 0 da âncora) → o navegador não assume o toque.
    if (touch.clientY - gesture.startY > 0) event.preventDefault();
  }, []);

  const detachNative = useCallback(() => {
    const container = nativeContainerRef.current;
    if (!container) return;
    container.removeEventListener("touchmove", onNativeTouchMove);
    container.style.overscrollBehaviorY = "";
    nativeContainerRef.current = null;
  }, [onNativeTouchMove]);

  const attachNative = useCallback(
    (container: HTMLElement) => {
      if (nativeContainerRef.current === container) return;
      detachNative();
      nativeContainerRef.current = container;
      container.style.overscrollBehaviorY = "contain";
      container.addEventListener("touchmove", onNativeTouchMove, { passive: false });
    },
    [detachNative, onNativeTouchMove],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType === "mouse" || !event.isPrimary) return;
      const container = readContainer(event);
      if (!container) return;
      // Conteúdo sem overflow não tem "topo para onde voltar".
      if (container.scrollHeight <= container.clientHeight) return;
      // Anexa o listener nativo não-passivo (removido ao fim do gesto).
      attachNative(container);
      // Registra a âncora SEMPRE (touch/pen válido) — o engajamento acontece
      // no pointerdown quando já está no rodapé OU no pointermove quando o
      // scroll atinge o fim no meio do gesto.
      gestureRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: performance.now(),
        velocity: 0,
        engaged: isAtBottomOf(container),
        container,
      };
      triggeredRef.current = false;
      if (gestureRef.current.engaged) {
        setState("at_bottom");
      }
      // Sem setPointerCapture: o gesto coexiste com o swipe-to-action das
      // linhas (arrasto horizontal mantém dy ~ 0 e desarma o pull-up).
    },
    [attachNative, disabled, isAtBottomOf, readContainer],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;

      // --- Engajamento no meio do gesto --------------------------------
      // O usuário rolou e atingiu o fim DURANTE este mesmo toque: re-ancora
      // `startY` neste instante e passa a acumular o pull a partir daqui
      // (o deslocamento anterior era rolagem, não tensão).
      if (!gesture.engaged) {
        const container = gesture.container ?? readContainer(event);
        if (!container || !isAtBottomOf(container)) return; // segue esperando o rodapé
        gesture.startY = event.clientY;
        gesture.lastY = event.clientY;
        gesture.lastTime = performance.now();
        gesture.velocity = 0;
        gesture.engaged = true;
        gesture.container = container;
        triggeredRef.current = false;
        setState("at_bottom");
        return;
      }

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
      if (!isAtBottomOf(container)) {
        gestureRef.current = null;
        triggeredRef.current = false;
        setPullDistance(0);
        setProgress(0);
        detachNative();
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
    },
    [detachNative, isAtBottomOf, readContainer],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      detachNative();
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      // Decisão por ref (nunca closure stale): o threshold sustenta até a
      // soltura se o dedo não recuou nem o contêiner saiu do rodapé.
      if (triggeredRef.current) {
        triggeredRef.current = false;
        setState("triggered");
        handleScrollToTop(gesture.container);
      } else {
        setState("cancelled");
      }
      setPullDistance(0);
      setProgress(0);
      // Volta ao idle após o frame do estado final (feedback visível).
      requestAnimationFrame(() => setState("idle"));
    },
    [detachNative, handleScrollToTop],
  );

  const onPointerCancel = useCallback(() => {
    gestureRef.current = null;
    triggeredRef.current = false;
    detachNative();
    setPullDistance(0);
    setProgress(0);
    setState("cancelled");
    requestAnimationFrame(() => setState("idle"));
  }, [detachNative]);

  // Cleanup do gesto e do listener nativo pendentes no unmount.
  useEffect(() => {
    return () => {
      gestureRef.current = null;
      detachNative();
    };
  }, [detachNative]);

  return {
    state,
    progress,
    pullDistance,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
