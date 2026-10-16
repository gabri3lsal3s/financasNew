import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { NetworkStatusBanner } from "./network-status-banner";
import { resetNetworkStatusForTesting } from "@/services/network-status";

function renderWithClient(ui: React.ReactElement, client = new QueryClient()) {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

describe("NetworkStatusBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    resetNetworkStatusForTesting(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não renderiza nada quando o aplicativo está conectado à internet", () => {
    renderWithClient(<NetworkStatusBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("exibe o banner de aviso quando o sinal de internet é perdido", () => {
    renderWithClient(<NetworkStatusBanner />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(
      screen.getByText(/Você está sem conexão com a internet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar reconectar/i })).toBeInTheDocument();
  });

  it("permite acionar a tentativa de reconexão manual e invalida as queries", () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderWithClient(<NetworkStatusBanner />, queryClient);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const retryButton = screen.getByRole("button", { name: /Tentar reconectar/i });
    expect(retryButton).toBeInTheDocument();

    act(() => {
      retryButton.click();
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("exibe notificação de conexão restabelecida ao voltar online e desaparece após temporizador", () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderWithClient(<NetworkStatusBanner />, queryClient);

    // 1. Perde a conexão
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/Você está sem conexão com a internet/i)).toBeInTheDocument();

    // 2. Retoma a conexão
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Invalida as queries automaticamente para sincronizar
    expect(invalidateSpy).toHaveBeenCalled();
    expect(
      screen.getByText(/Conexão restabelecida. Seus dados estão sincronizados./i),
    ).toBeInTheDocument();

    // 3. Aguarda o tempo de exibição do banner restaurado (3500ms)
    act(() => {
      vi.advanceTimersByTime(3600);
    });

    // O banner deve desaparecer
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
