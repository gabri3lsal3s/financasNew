import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SplitPublicPage } from "./split-public-page";
import * as publicShareQuery from "@/state/queries/use-public-shares";
import * as toastService from "@/services/toast";
import type { PublicShare } from "@/types";

vi.mock("@/state/queries/use-public-shares");
vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

const mockPublicShare: PublicShare = {
  id: "share-123",
  user_id: "user-456",
  kind: "split",
  token: "abc12345",
  payload: {
    title: "Jantar de Aniversario",
    total_cents: 12000,
    date: "2026-11-05",
    people_count: 3,
    guest_share_cents: 4000,
    host_share_cents: 4000,
    participants: [
      { name: "Gabriel (Anfitriao)", share_cents: 4000, is_host: true },
      { name: "Mariana", share_cents: 4000, is_host: false },
      { name: "Lucas", share_cents: 4000, is_host: false },
    ],
    remainder_policy: "host",
    host_name: "Gabriel Sales",
    host_city: "SAO PAULO",
    pix_key: "gabriel@exemplo.com",
    pix_key_type: "email",
    pix_br_code: "00020126580014BR.GOV.BCB.PIX0119gabriel@exemplo.com520400005303986540540.005802BR5913Gabriel Sales6009SAO PAULO62070503***6304ABCD",
  },
  created_at: "2026-11-05T12:00:00Z",
  expires_at: "2026-12-05T12:00:00Z",
  is_revoked: false,
  updated_at: "2026-11-05T12:00:00Z",
};

function renderPage(token = "abc12345") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/r/${token}`]}>
        <Routes>
          <Route path="/r/:token" element={<SplitPublicPage />} />
          <Route path="/apresentacao" element={<div>Pagina Apresentacao</div>} />
          <Route path="/cadastro" element={<div>Pagina Cadastro</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SplitPublicPage (/r/:token)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe estado de carregamento esqueleto enquanto busca dados", () => {
    vi.spyOn(publicShareQuery, "usePublicShare").mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof publicShareQuery.usePublicShare>);

    renderPage();
    // Skeleton com animate-shimmer presente
    expect(document.querySelector(".animate-shimmer")).toBeInTheDocument();
  });

  it("exibe estado vazio quando o link for inexistente, revogado ou invalido", () => {
    vi.spyOn(publicShareQuery, "usePublicShare").mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof publicShareQuery.usePublicShare>);

    renderPage();
    expect(screen.getByText("Racha não encontrado ou expirado")).toBeInTheDocument();
    expect(screen.getByText("Conhecer o Áxis Finance")).toBeInTheDocument();
  });

  it("renderiza detalhes do racha ativo com valor e dados do anfitriao", () => {
    vi.spyOn(publicShareQuery, "usePublicShare").mockReturnValue({
      data: mockPublicShare,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof publicShareQuery.usePublicShare>);

    renderPage();

    expect(screen.getByText("Jantar de Aniversario")).toBeInTheDocument();
    expect(screen.getByText("Gabriel Sales")).toBeInTheDocument();
    expect(screen.getByText("05/11/2026")).toBeInTheDocument();
    expect(screen.getByText("3 participantes")).toBeInTheDocument();
    expect(screen.getByText(/Valor total da conta: R\$ 120,00/i)).toBeInTheDocument();

    // Destaque "Sua parte a pagar"
    expect(screen.getByText("Sua parte a pagar")).toBeInTheDocument();

    // Botao principal de copiar Pix com o valor da parte
    expect(screen.getByRole("button", { name: /Copiar código Pix no valor de/i })).toBeInTheDocument();
  });

  it("copia o Pix Copia e Cola ao clicar no botao principal e exibe feedback", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    vi.spyOn(publicShareQuery, "usePublicShare").mockReturnValue({
      data: mockPublicShare,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof publicShareQuery.usePublicShare>);

    renderPage();

    const copyBtn = screen.getByRole("button", { name: /Copiar código Pix no valor de/i });
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(mockPublicShare.payload.pix_br_code);
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Código Pix copiado!",
        variant: "success",
      }),
    );
    expect(screen.getByText("Código Pix Copiado!")).toBeInTheDocument();
  });

  it("alterna a exibicao do QR Code client-side e permite copiar a chave Pix direta", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    vi.spyOn(publicShareQuery, "usePublicShare").mockReturnValue({
      data: mockPublicShare,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof publicShareQuery.usePublicShare>);

    renderPage();

    const toggleQrBtn = screen.getByRole("button", { name: /Exibir QR Code Pix/i });
    expect(screen.queryByRole("img", { name: "Código QR Pix oficial" })).not.toBeInTheDocument();

    await user.click(toggleQrBtn);

    // Agora o QR Code esta visivel
    expect(screen.getByRole("img", { name: "Código QR Pix oficial" })).toBeInTheDocument();
    expect(screen.getByText("gabriel@exemplo.com")).toBeInTheDocument();

    // Copiar chave direta
    const copyKeyBtn = screen.getByRole("button", { name: /Copiar chave Pix diretamente/i });
    await user.click(copyKeyBtn);
    expect(writeTextSpy).toHaveBeenCalledWith("gabriel@exemplo.com");
    expect(screen.getByText("Copiada")).toBeInTheDocument();
  });

  it("renderiza a lista de participantes discriminados", () => {
    vi.spyOn(publicShareQuery, "usePublicShare").mockReturnValue({
      data: mockPublicShare,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof publicShareQuery.usePublicShare>);

    renderPage();

    expect(screen.getByText("Divisão entre os participantes")).toBeInTheDocument();
    expect(screen.getByText("Gabriel (Anfitriao)")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByText("Lucas")).toBeInTheDocument();
  });

  it("exibe cartao de auto-onboarding com link para criacao de conta", () => {
    vi.spyOn(publicShareQuery, "usePublicShare").mockReturnValue({
      data: mockPublicShare,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof publicShareQuery.usePublicShare>);

    renderPage();

    expect(screen.getByText("Controle financeiro pessoal inteligente")).toBeInTheDocument();
    expect(screen.getByText("Salvar esta despesa no meu controle financeiro")).toBeInTheDocument();
  });
});
