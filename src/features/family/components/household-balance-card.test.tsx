import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HouseholdBalanceCard } from "./household-balance-card";
import type { FamilyConsolidationMember } from "@/types";

const mockMembers: FamilyConsolidationMember[] = [
  {
    user_id: "user-1",
    display_name: "Gabriel",
    role: "owner",
    spent_cents: 300000,
    percentage_of_total: 60,
    pix_key: "gabriel@email.com",
    pix_key_type: "email",
    split_ratio: null,
  },
  {
    user_id: "user-2",
    display_name: "Mariana",
    role: "member",
    spent_cents: 200000,
    percentage_of_total: 40,
    pix_key: "11999999999",
    pix_key_type: "phone",
    split_ratio: null,
  },
];

describe("HouseholdBalanceCard", () => {
  it("renderiza participantes e barra de proporção quando há gastos", () => {
    const handleOpen = vi.fn();
    render(
      <HouseholdBalanceCard
        members={mockMembers}
        splitRule="equal"
        isSettled={false}
        settlement={null}
        hasPostSettlementExpenses={false}
        onOpenSettlement={handleOpen}
      />,
    );

    expect(screen.getByText("Equilíbrio do Mês")).toBeInTheDocument();
    expect(screen.getByText("Pendente de acerto")).toBeInTheDocument();
    expect(screen.getByText("Divisão igualitária (50% / 50%)")).toBeInTheDocument();
    expect(screen.getByText("Gabriel")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Proporção de gastos por participante" })).toBeInTheDocument();

    const ctaButton = screen.getByRole("button", { name: /Acertar Contas/ });
    expect(ctaButton).toBeInTheDocument();
    fireEvent.click(ctaButton);
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });

  it("renderiza estado de acerto realizado", () => {
    render(
      <HouseholdBalanceCard
        members={mockMembers}
        splitRule="equal"
        isSettled={true}
        settlement={{
          id: "set-1",
          month: "2026-11",
          payer_id: "user-2",
          payer_name: "Mariana",
          receiver_id: "user-1",
          receiver_name: "Gabriel",
          amount_cents: 50000,
          payment_method: "pix",
          notes: null,
          settled_at: "2026-11-05T10:00:00Z",
          created_at: "2026-11-05T10:00:00Z",
        }}
        hasPostSettlementExpenses={false}
        onOpenSettlement={vi.fn()}
      />,
    );

    expect(screen.getByText("Acerto realizado")).toBeInTheDocument();
    expect(screen.getByText("Acerto de contas realizado para esta competência.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver Detalhes do Acerto" })).toBeInTheDocument();
  });

  it("renderiza alerta de despesas pós-acerto", () => {
    render(
      <HouseholdBalanceCard
        members={mockMembers}
        splitRule="equal"
        isSettled={true}
        settlement={null}
        hasPostSettlementExpenses={true}
        onOpenSettlement={vi.fn()}
      />,
    );

    expect(screen.getByText("Despesas pós-acerto")).toBeInTheDocument();
    expect(
      screen.getByText(/Novas despesas foram lançadas após o último acerto registrado/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acertar Contas (Pix)" })).toBeInTheDocument();
  });
});
