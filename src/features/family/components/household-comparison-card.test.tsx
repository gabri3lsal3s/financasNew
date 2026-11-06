import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HouseholdComparisonCard } from "./household-comparison-card";
import type { FamilyConsolidationExpense, FamilyConsolidationMember } from "@/types";

const mockMembers: FamilyConsolidationMember[] = [
  {
    user_id: "user-1",
    role: "owner",
    display_name: "Gabriel",
    spent_cents: 300000,
    percentage_of_total: 60,
    pix_key: "gabriel@email.com",
    pix_key_type: "email",
    split_ratio: null,
  },
  {
    user_id: "user-2",
    role: "member",
    display_name: "Mariana",
    spent_cents: 200000,
    percentage_of_total: 40,
    pix_key: "11999999999",
    pix_key_type: "phone",
    split_ratio: null,
  },
];

const mockExpenses: FamilyConsolidationExpense[] = [
  {
    id: "exp-1",
    description: "Supermercado Semanal",
    date: "2026-11-03",
    amount_cents: 300000,
    category_id: "cat-1",
    category_name: "Supermercado",
    category_icon: "shopping-cart",
    category_color: "#10b981",
    user_id: "user-1",
    payer_name: "Gabriel",
    is_own: true,
    created_at: "2026-11-03T10:00:00Z",
  },
  {
    id: "exp-2",
    description: "Conta de Energia",
    date: "2026-11-04",
    amount_cents: 200000,
    category_id: "cat-2",
    category_name: "Contas",
    category_icon: "zap",
    category_color: "#f59e0b",
    user_id: "user-2",
    payer_name: "Mariana",
    is_own: false,
    created_at: "2026-11-04T10:00:00Z",
  },
];

describe("HouseholdComparisonCard", () => {
  it("renderiza o empty state quando não houver despesas", () => {
    render(
      <HouseholdComparisonCard
        members={mockMembers}
        expenses={[]}
        monthlyCeilingCents={500000}
        splitRule="equal"
        month="2026-11"
      />,
    );

    expect(screen.getByText("Gráfico Comparativo")).toBeInTheDocument();
    expect(screen.getByText("Meta 50% / 50%")).toBeInTheDocument();
    expect(screen.getByText("Nenhum gasto para comparar")).toBeInTheDocument();
  });

  it("renderiza métricas comparativas e participantes quando houver despesas", () => {
    render(
      <HouseholdComparisonCard
        members={mockMembers}
        expenses={mockExpenses}
        monthlyCeilingCents={500000}
        splitRule="equal"
        month="2026-11"
      />,
    );

    expect(screen.getByText("Gráfico Comparativo")).toBeInTheDocument();
    expect(screen.getByText("Gabriel")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByText("Maior gasto")).toBeInTheDocument();

    // Mariana pagou 2.000 de um total de 5.000 (cota de cada um é 2.500)
    // Gabriel recebe R$ 500,00 e Mariana acerta R$ 500,00
    expect(screen.getByText(/Recebe/)).toBeInTheDocument();
    expect(screen.getByText(/Acerta/)).toBeInTheDocument();

    // Verificação de progressbars dos participantes
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBe(2);
  });
});
