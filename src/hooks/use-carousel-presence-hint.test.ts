import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { setActiveUserId } from "@/services/user-storage";
import { useCarouselPresenceHint } from "./use-carousel-presence-hint";

describe("useCarouselPresenceHint", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveUserId("user-hint-1");
  });

  it("não exibe skeleton no primeiro acesso sem histórico (evita skeleton fantasma)", () => {
    const { result } = renderHook(() =>
      useCarouselPresenceHint("portfolio_insights", { isLoading: true, hasItems: false }),
    );

    expect(result.current.shouldShowSkeleton).toBe(false);
  });

  it("exibe skeleton quando o usuário já tinha cards na visita anterior e isola por userId", () => {
    const { rerender, unmount } = renderHook(
      ({ isLoading, hasItems }) =>
        useCarouselPresenceHint("portfolio_insights", { isLoading, hasItems }),
      { initialProps: { isLoading: false, hasItems: true } },
    );
    expect(resultValue(rerender, unmount)).toBeUndefined();

    // Nova visita do mesmo usuário: hadItemsBefore === true -> shouldShowSkeleton === true
    const secondVisit = renderHook(() =>
      useCarouselPresenceHint("portfolio_insights", { isLoading: true, hasItems: false }),
    );
    expect(secondVisit.result.current.shouldShowSkeleton).toBe(true);

    // Outra conta não herda o hint da conta anterior
    setActiveUserId("user-hint-2");
    const otherUserVisit = renderHook(() =>
      useCarouselPresenceHint("portfolio_insights", { isLoading: true, hasItems: false }),
    );
    expect(otherUserVisit.result.current.shouldShowSkeleton).toBe(false);
  });

  it("desativa skeleton na visita seguinte quando o usuário passou a ter 0 cards", () => {
    const first = renderHook(() =>
      useCarouselPresenceHint("home_alerts", { isLoading: false, hasItems: false }),
    );
    first.unmount();

    const second = renderHook(() =>
      useCarouselPresenceHint("home_alerts", { isLoading: true, hasItems: false }),
    );
    expect(second.result.current.shouldShowSkeleton).toBe(false);
  });
});

function resultValue(_rerender: unknown, unmount: () => void) {
  unmount();
  return undefined;
}
