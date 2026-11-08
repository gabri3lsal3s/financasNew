import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router";
import { ThemeProvider } from "@/app/theme-provider";
import { SharedLinkHeaderNav } from "./shared-link-header-nav";
import * as platformModule from "@/services/native/platform";
import * as pwaModule from "@/app/pwa";
import * as authHook from "@/hooks/use-auth";

vi.mock("@/services/native/platform");
vi.mock("@/app/pwa");
vi.mock("@/hooks/use-auth");

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <BrowserRouter>{ui}</BrowserRouter>
    </ThemeProvider>
  );
}

describe("SharedLinkHeaderNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformModule.isNativePlatform).mockReturnValue(false);
    vi.mocked(pwaModule.isStandaloneMode).mockReturnValue(false);
    vi.mocked(authHook.useAuth).mockReturnValue({ session: null } as unknown as ReturnType<typeof authHook.useAuth>);
  });

  it("renderiza versão de navegador comum com botão Abrir no App e alternador de tema", () => {
    renderWithProviders(
      <SharedLinkHeaderNav badgeLabel="Racha de Conta" targetPath="r/tok123" />
    );

    expect(screen.getByText("Racha de Conta")).toBeInTheDocument();
    expect(screen.getByText("Abrir no App")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /alternar tema/i })).toBeInTheDocument();
    expect(screen.queryByText("Voltar ao Início")).not.toBeInTheDocument();
  });

  it("renderiza botão Voltar ao Início quando em ambiente PWA standalone", () => {
    vi.mocked(pwaModule.isStandaloneMode).mockReturnValue(true);

    renderWithProviders(
      <SharedLinkHeaderNav badgeLabel="Termômetro de Meta" targetPath="meta/tok456" />
    );

    expect(screen.getByText("Termômetro de Meta")).toBeInTheDocument();
    expect(screen.getByText("Voltar ao Início")).toBeInTheDocument();
    expect(screen.queryByText("Abrir no App")).not.toBeInTheDocument();
  });

  it("renderiza atalho Meu Painel quando usuário estiver autenticado no navegador", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-123" } },
    } as unknown as ReturnType<typeof authHook.useAuth>);

    renderWithProviders(
      <SharedLinkHeaderNav badgeLabel="Orçamento Familiar" targetPath="orcamento-familiar/tok789" />
    );

    expect(screen.getByText("Meu Painel")).toBeInTheDocument();
  });
});
