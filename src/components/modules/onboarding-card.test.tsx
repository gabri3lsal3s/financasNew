import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import { OnboardingCard } from "./onboarding-card";
import type { OnboardingCounts } from "@/domain/onboarding";

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const empty: OnboardingCounts = { expenseCategories: 0, incomeCategories: 0, cards: 0, transactions: 0 };
const partial: OnboardingCounts = { expenseCategories: 1, incomeCategories: 0, cards: 1, transactions: 0 };
const full: OnboardingCounts = { expenseCategories: 1, incomeCategories: 1, cards: 1, transactions: 1 };

describe("OnboardingCard — checklist de primeiro uso (§5.7)", () => {
  it("conta vazia: exibe os 4 passos pendentes com progresso 0/4", () => {
    render(<OnboardingCard counts={empty} />);
    expect(screen.getByText("Configure sua conta")).toBeInTheDocument();
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Configurar" })).toHaveLength(4);
  });

  it("progresso parcial: passos concluídos ficam marcados e sem CTA", () => {
    render(<OnboardingCard counts={partial} />);
    expect(screen.getByText("2/4")).toBeInTheDocument();
    // Done: expense-category e card → 2 CTAs restantes (income + first-transaction)
    expect(screen.getAllByRole("button", { name: "Configurar" })).toHaveLength(2);
    expect(screen.getByText("Crie categorias de despesa")).toBeInTheDocument();
    expect(screen.getByText("Adicione um cartão de crédito")).toBeInTheDocument();
  });

  it("setup completo: nenhum CTA pendente", () => {
    render(<OnboardingCard counts={full} />);
    expect(screen.getByText("4/4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurar" })).not.toBeInTheDocument();
  });

  it("CTAs apontam para as rotas corretas", () => {
    render(<OnboardingCard counts={empty} />);
    const hrefs = screen.getAllByRole("link", { name: "Configurar" }).map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/categorias?type=expense",
      "/categorias?type=income",
      "/cartoes",
      "/transacoes?novo=transacao",
    ]);
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<OnboardingCard counts={partial} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
