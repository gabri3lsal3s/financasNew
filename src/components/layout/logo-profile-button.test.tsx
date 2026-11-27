import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoProfileButton } from "./logo-profile-button";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignOut = vi.fn();
vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "gabriel@exemplo.com",
      user_metadata: { name: "Gabriel Sales" },
    },
    session: {},
    loading: false,
    configError: null,
  }),
}));

const mockSubscription = {
  isPro: false,
  isTrial: true,
  isReadOnly: false,
  trialDaysRemaining: 14,
  plan: null,
  tier: "trial" as const,
  trialEndsAt: "2026-09-15",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  isFullAccess: true,
};

vi.mock("@/state/queries/use-user-subscription", () => ({
  useUserSubscription: () => mockSubscription,
}));

describe("LogoProfileButton (mobile & desktop)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza no mobile com ícone e abre o modal de perfil ao clicar", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Abrir perfil do usuário" });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByText("Guia Financeiro")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Gabriel Sales")).toBeInTheDocument();
    expect(screen.getByText("gabriel@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText("Sessão Segura")).toBeInTheDocument();
    expect(screen.getByText(/Teste Pro/i)).toBeInTheDocument();
    expect(screen.getByText(/Axir - v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  it("renderiza no desktop com nome/wordmark e abre o modal de perfil ao clicar", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton showWordmark={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Axir|Áxis|Axis/i)).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Abrir perfil do usuário" });
    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("exibe banner de upgrade e botão de assinar quando usuário não tem Plano Pro", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));

    expect(screen.getByText("Desbloqueie o Plano Pro")).toBeInTheDocument();
    const upgradeButton = screen.getByRole("button", { name: /Assinar/i });
    expect(upgradeButton).toBeInTheDocument();

    await user.click(upgradeButton);
    expect(mockNavigate).toHaveBeenCalledWith("/assinatura");
  });

  it("atalho 'Minha Conta & Perfil' navega exatamente para a tab account", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Minha Conta & Perfil/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=account");
  });

  it("atalho 'Aparência & Tema' navega exatamente para a tab appearance", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Aparência & Tema/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=appearance");
  });

  it("atalho 'Notificações & Alertas' navega exatamente para a tab notifications", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Notificações & Alertas/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=notifications");
  });

  it("atalho 'Segurança & Dados' navega exatamente para a tab security", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Segurança & Dados/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=security");
  });

  it("atalho 'Gerenciar Assinatura' navega exatamente para a tab subscription", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Gerenciar Assinatura/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=subscription");
  });

  it("botão 'Sair da Conta' dispara logout ancorado no rodapé", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    const logoutBtn = screen.getByRole("button", { name: /Sair da Conta/i });
    expect(logoutBtn.className).toContain("text-critical-strong");
    await user.click(logoutBtn);

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("atalho 'Rever Tour Guiado' abre o modal de seleção de trilha", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Rever Tour Guiado \(Modo Simulação\)/i }));

    expect(await screen.findByText("Escolha sua Trilha de Demonstração")).toBeInTheDocument();
  });

  it("atalho 'Central de Ajuda & Suporte' abre o modal de ajuda", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Central de Ajuda & Suporte/i }));

    expect(await screen.findByText("Central de Ajuda & Suporte")).toBeInTheDocument();
    expect(screen.getByText("Tour Guiado & Modo Simulação")).toBeInTheDocument();
  });
});
