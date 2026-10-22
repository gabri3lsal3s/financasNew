import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingCard } from "./onboarding-card";
import type { OnboardingCounts } from "@/domain/onboarding";

const mockRequestNotificationListenerPermission = vi.fn().mockResolvedValue(true);

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@/state", () => ({
  useLoadDemoData: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
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
  cards: 1,
  transactions: 0,
  notificationsEnabled: false,
};

const full: OnboardingCounts = {
  expenseCategories: 1,
  incomeCategories: 1,
  cards: 1,
  transactions: 1,
  notificationsEnabled: true,
};

describe("OnboardingCard — checklist de primeiro uso com captura inteligente (§5.7 / Fase 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("conta vazia: exibe os 5 passos pendentes com progresso 0/5 (0%)", () => {
    render(<OnboardingCard counts={empty} />);
    expect(screen.getByText("Configure sua conta")).toBeInTheDocument();
    expect(screen.getByText("0/5")).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
    expect(progressBar).toHaveAttribute("aria-label", "Progresso da configuração: 0 de 5");

    expect(screen.getAllByRole("button", { name: "Configurar" })).toHaveLength(5);
    expect(screen.getByText("Ativar Leitor Automático de Notificações")).toBeInTheDocument();
  });

  it("progresso parcial: passos concluídos ficam marcados e cálculo percentual reflete 40%", () => {
    render(<OnboardingCard counts={partial} />);
    expect(screen.getByText("2/5")).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "40");
    expect(progressBar).toHaveAttribute("aria-label", "Progresso da configuração: 2 de 5");

    // Concluídos: expense-category e card → 3 CTAs restantes (income, first-transaction, bank-notifications)
    expect(screen.getAllByRole("button", { name: "Configurar" })).toHaveLength(3);
    expect(screen.getByText("Crie categorias de despesa")).toBeInTheDocument();
    expect(screen.getByText("Adicione um cartão de crédito")).toBeInTheDocument();
    expect(screen.getByText("Ativar Leitor Automático de Notificações")).toBeInTheDocument();
  });

  it("setup completo: 5/5 (100%), nenhum CTA pendente e mensagem de conclusão", () => {
    render(<OnboardingCard counts={full} />);
    expect(screen.getByText("5/5")).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
    expect(progressBar).toHaveAttribute("aria-label", "Progresso da configuração: 5 de 5");

    expect(screen.queryByRole("button", { name: "Configurar" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Setup completo — parabéns! Esta seção será recolhida."),
    ).toBeInTheDocument();
  });

  it("CTAs de navegação apontam para as rotas corretas", () => {
    render(<OnboardingCard counts={empty} />);
    const hrefs = screen
      .getAllByRole("link", { name: "Configurar" })
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/categorias?type=expense",
      "/categorias?type=income",
      "/cartoes",
      "/transacoes?novo=transacao",
    ]);
  });

  it("aciona abertura de permissões do sistema Android ao clicar em Configurar no leitor de notificações", () => {
    render(<OnboardingCard counts={empty} />);
    const buttons = screen.getAllByRole("button", { name: "Configurar" });
    // O último botão é o do passo de notificações (não está embrulhado em <Link>)
    const notifButton = buttons[buttons.length - 1];
    expect(notifButton).toBeDefined();

    if (notifButton) {
      fireEvent.click(notifButton);
    }
    expect(mockRequestNotificationListenerPermission).toHaveBeenCalledTimes(1);
  });

  it("executa callback customizado onEnableNotifications quando fornecido", () => {
    const handleEnableMock = vi.fn();
    render(<OnboardingCard counts={empty} onEnableNotifications={handleEnableMock} />);
    const buttons = screen.getAllByRole("button", { name: "Configurar" });
    const notifButton = buttons[buttons.length - 1];
    expect(notifButton).toBeDefined();

    if (notifButton) {
      fireEvent.click(notifButton);
    }
    expect(handleEnableMock).toHaveBeenCalledTimes(1);
    expect(mockRequestNotificationListenerPermission).not.toHaveBeenCalled();
  });

  it("exibe a dica educativa de contingência para compartilhamento de comprovante", () => {
    render(<OnboardingCard counts={empty} />);
    expect(screen.getByText("Dica de contingência")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Seu banco não notificou uma transferência? Basta tocar em Compartilhar Comprovante para o Guia Financeiro.",
      ),
    ).toBeInTheDocument();
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<OnboardingCard counts={partial} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
