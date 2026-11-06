import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router";
import { SharedLinkHeaderNav } from "./shared-link-header-nav";
import * as platformModule from "@/services/native/platform";
import * as pwaModule from "@/app/pwa";
import * as authHook from "@/hooks/use-auth";

vi.mock("@/services/native/platform");
vi.mock("@/app/pwa");
vi.mock("@/hooks/use-auth");

describe("SharedLinkHeaderNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformModule.isNativePlatform).mockReturnValue(false);
    vi.mocked(pwaModule.isStandaloneMode).mockReturnValue(false);
    vi.mocked(authHook.useAuth).mockReturnValue({ session: null } as unknown as ReturnType<typeof authHook.useAuth>);
  });

  it("renderiza versão de navegador comum com botão Abrir no App", () => {
    render(
      <BrowserRouter>
        <SharedLinkHeaderNav badgeLabel="Racha de Conta" targetPath="r/tok123" />
      </BrowserRouter>
    );

    expect(screen.getByText("Racha de Conta")).toBeInTheDocument();
    expect(screen.getByText("Abrir no App")).toBeInTheDocument();
    expect(screen.queryByText("Voltar ao Início")).not.toBeInTheDocument();
  });

  it("renderiza botão Voltar ao Início quando em ambiente PWA standalone", () => {
    vi.mocked(pwaModule.isStandaloneMode).mockReturnValue(true);

    render(
      <BrowserRouter>
        <SharedLinkHeaderNav badgeLabel="Termômetro de Meta" targetPath="meta/tok456" />
      </BrowserRouter>
    );

    expect(screen.getByText("Termômetro de Meta")).toBeInTheDocument();
    expect(screen.getByText("Voltar ao Início")).toBeInTheDocument();
    expect(screen.queryByText("Abrir no App")).not.toBeInTheDocument();
  });

  it("renderiza atalho Meu Painel quando usuário estiver autenticado no navegador", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-123" } },
    } as unknown as ReturnType<typeof authHook.useAuth>);

    render(
      <BrowserRouter>
        <SharedLinkHeaderNav badgeLabel="Orçamento Familiar" targetPath="orcamento-familiar/tok789" />
      </BrowserRouter>
    );

    expect(screen.getByText("Meu Painel")).toBeInTheDocument();
  });
});
