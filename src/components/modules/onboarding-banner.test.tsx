import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingBanner } from "./onboarding-banner";
import type { OnboardingCounts } from "@/domain/onboarding";

const mockRequestNotificationListenerPermission = vi.fn().mockResolvedValue(true);
const mockNavigate = vi.fn();

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock("@/services/native", () => ({
  requestNotificationListenerPermission: () => mockRequestNotificationListenerPermission(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

const empty: OnboardingCounts = {
  expenseCategories: 0,
  incomeCategories: 0,
  cards: 0,
  transactions: 0,
  notificationsEnabled: false,
};

const partial: OnboardingCounts = {
  expenseCategories: 1,
  incomeCategories: 0,
  cards: 0,
  transactions: 0,
  notificationsEnabled: false,
};

describe("OnboardingBanner — banner compacto de configuração inicial (§5.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe o banner slim com progresso e botão Continuar", () => {
    render(<OnboardingBanner counts={empty} onDismiss={vi.fn()} />);
    expect(screen.getByText("Configure sua conta")).toBeInTheDocument();
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dispensar aviso/i })).toBeInTheDocument();
  });

  it("progresso parcial reflete contagem correta de passos core", () => {
    render(<OnboardingBanner counts={partial} onDismiss={vi.fn()} />);
    expect(screen.getByText("1/4")).toBeInTheDocument();
  });

  it("botão Continuar abre o modal com o checklist completo", () => {
    render(<OnboardingBanner counts={empty} onDismiss={vi.fn()} />);
    expect(screen.queryByText("Crie categorias de despesa")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    expect(screen.getByText("Crie categorias de despesa")).toBeInTheDocument();
    expect(screen.getByText("Ativar Leitor Automático de Notificações")).toBeInTheDocument();
  });

  it("botão 'Explorar com Simulação' abre o modal de seleção de trilha", () => {
    render(<OnboardingBanner counts={empty} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    const simBtn = screen.getByRole("button", { name: /Explorar com Simulação/i });
    expect(simBtn).toBeInTheDocument();

    fireEvent.click(simBtn);
    expect(screen.getByText("Escolha sua Trilha de Demonstração")).toBeInTheDocument();
    expect(screen.getByText("Finanças Diárias & Cartões")).toBeInTheDocument();
    expect(screen.getByText("Investimentos & Rebalanceamento")).toBeInTheDocument();
  });

  it("botão de dismiss chama onDismiss e não abre o modal", () => {
    const dismissMock = vi.fn();
    render(<OnboardingBanner counts={empty} onDismiss={dismissMock} />);

    fireEvent.click(screen.getByRole("button", { name: /Dispensar aviso/i }));

    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Crie categorias de despesa")).not.toBeInTheDocument();
  });

  it("modal exibe a dica de contingência", () => {
    render(<OnboardingBanner counts={empty} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText("Dica de contingência")).toBeInTheDocument();
  });

  it("modal não exibe botão Configurar para passos já concluídos", () => {
    render(<OnboardingBanner counts={partial} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    const configurarButtons = screen.getAllByRole("button", { name: "Configurar" });
    expect(configurarButtons.length).toBeLessThan(5);
  });

  it("ativa permissões de notificação ao clicar em Configurar no passo de notificações", () => {
    render(<OnboardingBanner counts={empty} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    const buttons = screen.getAllByRole("button", { name: "Configurar" });
    const notifButton = buttons[buttons.length - 1];
    if (notifButton) fireEvent.click(notifButton);

    expect(mockRequestNotificationListenerPermission).toHaveBeenCalledTimes(1);
  });

  it("sem violações de acessibilidade no banner fechado", async () => {
    const { container } = render(<OnboardingBanner counts={partial} onDismiss={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
