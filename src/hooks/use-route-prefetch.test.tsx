import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoutePrefetch } from "./use-route-prefetch";

const prefetchMock = vi.fn();

vi.mock("@/app/routes", () => ({
  prefetchPageChunks: (...args: unknown[]) => prefetchMock(...args),
  appRoutes: [],
}));

function PrefetchHarness() {
  const location = useLocation();
  const navigate = useNavigate();
  useRoutePrefetch();
  return (
    <div>
      <span>rota: {location.pathname}</span>
      <button type="button" onClick={() => navigate("/cartoes")}>
        ir para cartoes
      </button>
    </div>
  );
}

function renderHarness(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<PrefetchHarness />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("useRoutePrefetch (F23)", () => {
  beforeEach(() => {
    prefetchMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pré-carrega as rotas primárias e as vizinhas no primeiro idle", () => {
    renderHarness("/");

    expect(prefetchMock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1_100);
    });

    const paths = prefetchMock.mock.calls[0]?.[0] as string[];
    // Primárias (sem a atual "/").
    expect(paths).toContain("/transacoes");
    expect(paths).toContain("/cartoes");
    expect(paths).toContain("/relatorios");
    expect(paths).toContain("/investments");
    // Vizinho seguinte da Home na ordem da navegação.
    expect(paths).toContain("/transacoes");
    // A rota atual nunca é pré-carregada.
    expect(paths).not.toContain("/");
  });

  it("pré-carrega os vizinhos da nova rota após navegação", () => {
    renderHarness("/");
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    prefetchMock.mockClear();

    act(() => {
      screen.getByRole("button", { name: /ir para cartoes/i }).click();
    });
    act(() => {
      vi.advanceTimersByTime(1_100);
    });

    const paths = prefetchMock.mock.calls[0]?.[0] as string[];
    // Vizinhos na ordem: /transacoes (anterior) e /dividas (próximo).
    expect(paths).toContain("/transacoes");
    expect(paths).toContain("/dividas");
    expect(paths).not.toContain("/cartoes");
  });

  it("é idempotente e silencioso (falha do import é ignorada)", () => {
    prefetchMock.mockRejectedValueOnce(new Error("offline"));
    renderHarness("/transacoes");
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });
});
