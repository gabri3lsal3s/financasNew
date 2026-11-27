import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { getVisualCustomization } from "@/hooks/use-visual-customization";

function isReducedMotionActive(): boolean {
  if (typeof window === "undefined") return true;
  const prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return prefersReduced || getVisualCustomization().motionLevel === "reduced";
}

export function useAporteUrlAnimations({
  availableCashCents,
  isPositionLoading,
}: {
  availableCashCents: number;
  isPositionLoading: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [userAporteCents, setUserAporteCents] = useState<number>(0);
  const [useBrokerageCash, setUseBrokerageCash] = useState(false);
  const [cashUsedCents, setCashUsedCents] = useState<number>(0);
  const [cashHighlight, setCashHighlight] = useState(false);

  const animatedRafRef = useRef<number | null>(null);
  const cashAnimatedRafRef = useRef<number | null>(null);
  const lastParamValorRef = useRef<string | null>(null);
  const pendingInjectRef = useRef<number | null>(null);
  const pendingUseCashRef = useRef<boolean>(false);

  const animateToCents = useCallback(
    (targetCents: number, fromCents?: number) => {
      const baseFrom = fromCents !== undefined ? fromCents : userAporteCents;
      if (isReducedMotionActive() || typeof window.requestAnimationFrame !== "function" || targetCents === baseFrom) {
        setUserAporteCents(targetCents);
        return;
      }
      if (animatedRafRef.current) cancelAnimationFrame(animatedRafRef.current);
      const durationMs = 400;
      let startTimestamp: number | null = null;
      const tick = (now: number) => {
        if (startTimestamp === null) startTimestamp = now;
        const progress = Math.min(1, (now - startTimestamp) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setUserAporteCents(Math.round(baseFrom + (targetCents - baseFrom) * eased));
        if (progress < 1) {
          animatedRafRef.current = requestAnimationFrame(tick);
        } else {
          setUserAporteCents(targetCents);
          animatedRafRef.current = null;
        }
      };
      animatedRafRef.current = requestAnimationFrame(tick);
    },
    [userAporteCents],
  );

  const animateCashToCents = useCallback((targetCents: number, fromCents = 0) => {
    if (cashAnimatedRafRef.current) {
      cancelAnimationFrame(cashAnimatedRafRef.current);
      cashAnimatedRafRef.current = null;
    }
    if (isReducedMotionActive() || typeof window.requestAnimationFrame !== "function" || targetCents === fromCents) {
      setCashUsedCents(targetCents);
      return;
    }
    const duration = 700;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCashUsedCents(Math.round(fromCents + (targetCents - fromCents) * eased));
      if (progress < 1) {
        cashAnimatedRafRef.current = requestAnimationFrame(tick);
      } else {
        setCashUsedCents(targetCents);
        cashAnimatedRafRef.current = null;
      }
    };
    cashAnimatedRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (animatedRafRef.current) cancelAnimationFrame(animatedRafRef.current);
      if (cashAnimatedRafRef.current) cancelAnimationFrame(cashAnimatedRafRef.current);
    };
  }, []);

  useEffect(() => {
    const raw = searchParams.get("valor") || searchParams.get("surplusCents");
    const wantCash = searchParams.get("usarCaixa") === "1";

    let hasInjectedValue = false;
    if (!raw) {
      lastParamValorRef.current = null;
    } else if (raw !== lastParamValorRef.current) {
      lastParamValorRef.current = raw;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        pendingInjectRef.current = Math.round(parsed);
        hasInjectedValue = true;
      }
    }

    if (wantCash) {
      pendingUseCashRef.current = true;
    }

    if (wantCash || hasInjectedValue) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (wantCash) next.delete("usarCaixa");
          if (hasInjectedValue) {
            next.delete("valor");
            next.delete("surplusCents");
          }
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pendingInjectRef.current !== null) {
        animateToCents(pendingInjectRef.current, 0);
        pendingInjectRef.current = null;
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchParams, animateToCents]);

  useEffect(() => {
    if (!pendingUseCashRef.current || isPositionLoading || availableCashCents <= 0) return;
    let highlightTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      if (!pendingUseCashRef.current) return;
      pendingUseCashRef.current = false;
      setUseBrokerageCash(true);
      setCashHighlight(true);
      animateCashToCents(availableCashCents, 0);
      highlightTimer = setTimeout(() => setCashHighlight(false), 1800);
    }, 600);
    return () => {
      clearTimeout(timer);
      if (highlightTimer) clearTimeout(highlightTimer);
    };
  }, [searchParams, isPositionLoading, availableCashCents, animateCashToCents]);

  return {
    userAporteCents,
    setUserAporteCents,
    animateToCents,
    useBrokerageCash,
    setUseBrokerageCash,
    cashUsedCents,
    setCashUsedCents,
    cashHighlight,
  };
}
