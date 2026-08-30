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

vi.mock("@/state", () => ({
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
  });

  it("renderiza no desktop com nome/wordmark e abre o modal de perfil ao clicar", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton showWordmark={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Guia Financeiro")).toBeInTheDocument();

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

  it("atalho 'Segurança & Perfil' navega exatamente para a tab de segurança", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Segurança & Perfil/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=seguranca");
  });

  it("atalho 'Aparência & Tema' navega exatamente para a tab de personalização", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Aparência & Tema/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=personalizacao");
  });

  it("atalho 'Dados & Backup' navega para a tab de dados", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Dados & Backup/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=dados");
  });

  it("atalho 'Gerenciar Assinatura' navega para a tab de plano", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Gerenciar Assinatura/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=plano");
  });

  it("botão 'Sair da Conta' dispara logout", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LogoProfileButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir perfil do usuário" }));
    await user.click(screen.getByRole("button", { name: /Sair da Conta/i }));

    expect(mockSignOut).toHaveBeenCalled();
  });
});
