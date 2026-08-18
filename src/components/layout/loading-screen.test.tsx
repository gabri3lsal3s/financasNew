import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza a logo, barra de progresso e log inicial", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Iniciando sessão segura…")).toBeInTheDocument();
  });

  it("avança as etapas do log e porcentagem com o tempo", () => {
    render(<LoadingScreen />);

    expect(screen.getByText("Iniciando sessão segura…")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(
      screen.getByText("Sincronizando preferências e categorias…"),
    ).toBeInTheDocument();
  });

  it("permite customização de statusText fixo e progresso externo", () => {
    render(
      <LoadingScreen
        statusText="Restaurando cópia de segurança…"
        progress={65}
      />,
    );

    expect(
      screen.getByText("Restaurando cópia de segurança…"),
    ).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "65",
    );
  });
});
