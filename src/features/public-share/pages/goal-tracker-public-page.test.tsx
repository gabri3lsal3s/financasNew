import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoalTrackerPublicPage } from "./goal-tracker-public-page";
import * as publicShareQuery from "@/state/queries/use-public-shares";
import * as pwaInstallHook from "@/hooks/use-pwa-install";
import * as toastService from "@/services/toast";
import type { SharedGoalTrackerResult } from "@/types";

vi.mock("@/state/queries/use-public-shares");
vi.mock("@/hooks/use-pwa-install");
vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

const mockGoalTracker: SharedGoalTrackerResult = {
  token: "meta-test-123",
  title: "Viagem de Fim de Ano",
  category_id: "cat-123",
  target_cents: 600000,
  current_cents: 420000,
  remaining_cents: 180000,
  percentage: 70,
  deadline: "2026-12-31",
  days_remaining: 56,
  organizer_name: "Gabriel Sales",
  organizer_city: "SAO PAULO",
  pix_key: "gabriel@exemplo.com",
  pix_key_type: "email",
  pix_br_code: "00020126580014BR.GOV.BCB.PIX0119gabriel@exemplo.com5204000053039865802BR5913Gabriel Sales6009SAO PAULO62070503***6304ABCD",
  is_revoked: false,
  expires_at: null,
};

function renderPage(token = "meta-test-123") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/meta/${token}`]}>
        <Routes>
          <Route path="/meta/:token" element={<GoalTrackerPublicPage />} />
          <Route path="/apresentacao" element={<div>Pagina Apresentacao</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("GoalTrackerPublicPage (/meta/:token)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(pwaInstallHook, "usePWAInstall").mockReturnValue({
      canInstall: true,
      isIOS: false,
      isInstalled: false,
      isNativePromptAvailable: true,
      install: vi.fn(),
    });
  });

  it("exibe estado de carregamento esqueleto enquanto carrega os dados", () => {
    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();
    expect(document.querySelector(".animate-shimmer")).toBeInTheDocument();
  });

  it("exibe estado de link revogado ou inexistente quando os dados forem nulos", () => {
    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();
    expect(screen.getByText("Meta não encontrada ou expirada")).toBeInTheDocument();
    expect(screen.getByText("Conhecer o Axir")).toBeInTheDocument();
  });

  it("exibe estado de link revogado quando is_revoked for true", () => {
    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: { ...mockGoalTracker, is_revoked: true },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();
    expect(screen.getByText("Meta não encontrada ou expirada")).toBeInTheDocument();
  });

  it("renderiza o termômetro de meta com dados, valores e contagem regressiva", () => {
    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: mockGoalTracker,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();

    expect(screen.getByText("Viagem de Fim de Ano")).toBeInTheDocument();
    expect(screen.getByText(/Organizado por Gabriel Sales/)).toBeInTheDocument();
    expect(screen.getByText(/Em Arrecadação \(70%\)/)).toBeInTheDocument();
    expect(screen.getByText("70% concluído")).toBeInTheDocument();
    expect(screen.getByText(/56 dias restantes/)).toBeInTheDocument();
    expect(screen.getByText("Copiar Pix do Organizador")).toBeInTheDocument();
    expect(screen.getByText("gabriel@exemplo.com")).toBeInTheDocument();
  });

  it("renderiza estado de meta concluída quando atingir 100%", () => {
    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: {
        ...mockGoalTracker,
        percentage: 100,
        current_cents: 600000,
        remaining_cents: 0,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();

    expect(screen.getByText(/Meta Atingida \(100%\)/)).toBeInTheDocument();
    expect(screen.getByText("100% concluído")).toBeInTheDocument();
    expect(screen.getByText("Saldo Restante")).toBeInTheDocument();
    expect(screen.getByText("Meta 100% financiada")).toBeInTheDocument();
  });

  it("copia o Pix do organizador com um toque e exibe toast de sucesso", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: mockGoalTracker,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();

    const copyButton = screen.getByRole("button", { name: "Copiar Pix do Organizador" });
    await user.click(copyButton);

    expect(writeTextSpy).toHaveBeenCalledWith(mockGoalTracker.pix_br_code);
    expect(screen.getByText("Pix Copiado com Sucesso!")).toBeInTheDocument();
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Pix do organizador copiado!",
        variant: "success",
      }),
    );
  });

  it("copia a chave Pix individual quando clicado no botão dedicado", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: mockGoalTracker,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();

    const copyKeyBtn = screen.getByRole("button", { name: "Copiar apenas a chave Pix" });
    await user.click(copyKeyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(mockGoalTracker.pix_key);
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Chave Pix copiada!",
      }),
    );
  });

  it("permite alternar exibição do QR Code Pix", async () => {
    const user = userEvent.setup();
    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: mockGoalTracker,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();

    expect(screen.queryByText(/Abra o aplicativo do seu banco no celular/)).not.toBeInTheDocument();

    const qrToggleBtn = screen.getByRole("button", { name: /Exibir QR Code Pix/ });
    await user.click(qrToggleBtn);

    expect(screen.getByText(/Abra o aplicativo do seu banco no celular/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ocultar QR Code Pix/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Ocultar QR Code Pix/ }));
    expect(screen.queryByText(/Abra o aplicativo do seu banco no celular/)).not.toBeInTheDocument();
  });

  it("dispara refetch ao clicar no botão de atualizar", async () => {
    const user = userEvent.setup();
    const refetchMock = vi.fn().mockResolvedValue({} as unknown);

    vi.spyOn(publicShareQuery, "useSharedGoalTracker").mockReturnValue({
      data: mockGoalTracker,
      isLoading: false,
      isError: false,
      refetch: refetchMock,
      isRefetching: false,
    } as unknown as ReturnType<typeof publicShareQuery.useSharedGoalTracker>);

    renderPage();

    const refreshBtn = screen.getByRole("button", { name: "Atualizar dados do termômetro" });
    await user.click(refreshBtn);

    expect(refetchMock).toHaveBeenCalled();
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Termômetro atualizado",
      }),
    );
  });
});
