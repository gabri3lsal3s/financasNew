import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useInView } from "./use-in-view";

describe("useInView", () => {
  let observeMock: ReturnType<typeof vi.fn>;
  let unobserveMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;
  let intersectionCallback: (entries: IntersectionObserverEntry[]) => void;

  beforeEach(() => {
    observeMock = vi.fn();
    unobserveMock = vi.fn();
    disconnectMock = vi.fn();

    class MockIntersectionObserver {
      constructor(callback: (entries: IntersectionObserverEntry[], observer: unknown) => void) {
        intersectionCallback = (entries) => callback(entries, this);
      }
      observe = observeMock;
      unobserve = unobserveMock;
      disconnect = disconnectMock;
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function TestObserverComponent() {
    const [ref, inView] = useInView({ triggerOnce: true });
    return (
      <div ref={ref} data-testid="target">
        {inView ? "visivel" : "oculto"}
      </div>
    );
  }

  it("inicia oculto e atualiza para visível ao intersectar", () => {
    render(<TestObserverComponent />);

    const element = screen.getByTestId("target");
    expect(element.textContent).toBe("oculto");
    expect(observeMock).toHaveBeenCalledWith(element);

    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
          target: element,
        } as unknown as IntersectionObserverEntry,
      ]);
    });

    expect(element.textContent).toBe("visivel");
    expect(unobserveMock).toHaveBeenCalledWith(element);
    expect(disconnectMock).toHaveBeenCalled();
  });

  it("retorna true imediatamente se prefers-reduced-motion estiver ativo", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    render(<TestObserverComponent />);
    expect(screen.getByTestId("target").textContent).toBe("visivel");
    expect(observeMock).not.toHaveBeenCalled();
  });

  it("re-observa e reseta o estado quando resetKey é alterado", () => {
    function TestResetComponent({ resetKey }: { resetKey: number }) {
      const [ref, inView] = useInView({ triggerOnce: true, resetKey });
      return (
        <div ref={ref} data-testid="target">
          {inView ? "visivel" : "oculto"}
        </div>
      );
    }

    const { rerender } = render(<TestResetComponent resetKey={0} />);
    const element = screen.getByTestId("target");

    // Primeiro disparo de visibilidade
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
          target: element,
        } as unknown as IntersectionObserverEntry,
      ]);
    });
    expect(element.textContent).toBe("visivel");

    // Altera resetKey: reexecuta observer e o elemento fora do viewport volta a "oculto"
    rerender(<TestResetComponent resetKey={1} />);

    act(() => {
      intersectionCallback([
        {
          isIntersecting: false,
          target: element,
        } as unknown as IntersectionObserverEntry,
      ]);
    });
    expect(element.textContent).toBe("oculto");

    // Rola até ele de novo
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
          target: element,
        } as unknown as IntersectionObserverEntry,
      ]);
    });
    expect(element.textContent).toBe("visivel");
  });
});

