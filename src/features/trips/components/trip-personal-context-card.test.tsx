import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TripPersonalContextCard } from "./trip-personal-context-card";
import type { Trip, TripMember, TripMemberBalance } from "@/types/trips";

describe("TripPersonalContextCard Component", () => {
  const trip: Trip = {
    id: "trip-1",
    host_user_id: "user-alice",
    title: "Churrasco no Sítio",
    destination: "Atibaia",
    start_date: "2026-11-15",
    end_date: "2026-11-16",
    status: "active",
    currency: "BRL",
    public_token: "token-churras",
    passcode_hash: null,
    cover_photo_url: null,
    created_at: "",
    updated_at: "",
  };

  const memberAlice: TripMember = {
    id: "m-alice",
    trip_id: "trip-1",
    user_id: "user-alice",
    name: "Alice",
    is_host: true,
    pix_key: "alice@pix",
    pix_key_type: "email",
    created_at: "",
  };

  const memberBob: TripMember = {
    id: "m-bob",
    trip_id: "trip-1",
    user_id: "user-bob",
    name: "Bob",
    is_host: false,
    pix_key: "bob@pix",
    pix_key_type: "email",
    created_at: "",
  };

  it("retorna nulo se myMember for nulo", () => {
    const { container } = render(
      <TripPersonalContextCard
        trip={trip}
        myMember={null}
        myBalance={null}
        isHost={false}
        onOpenSettlement={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza organizador da viagem com badge correspondente", () => {
    const balance: TripMemberBalance = {
      memberId: "m-alice",
      name: "Alice",
      totalPaidCents: 50000,
      totalOwedCents: 20000,
      netBalanceCents: 30000,
    };

    render(
      <TripPersonalContextCard
        trip={trip}
        myMember={memberAlice}
        myBalance={balance}
        isHost={true}
        onOpenSettlement={vi.fn()}
      />
    );

    expect(screen.getByText("Organizador da Viagem")).toBeInTheDocument();
    expect(screen.getByText("A Receber")).toBeInTheDocument();
  });

  it("renderiza participante convidado e permite quitar cota no cenário devedor", () => {
    const onOpenSettlementMock = vi.fn();
    const balance: TripMemberBalance = {
      memberId: "m-bob",
      name: "Bob",
      totalPaidCents: 0,
      totalOwedCents: 15000,
      netBalanceCents: -15000,
    };

    render(
      <TripPersonalContextCard
        trip={trip}
        myMember={memberBob}
        myBalance={balance}
        isHost={false}
        onOpenSettlement={onOpenSettlementMock}
      />
    );

    expect(screen.getByText("Participante Conectado")).toBeInTheDocument();
    expect(screen.getByText("A Pagar")).toBeInTheDocument();

    const payBtn = screen.getByRole("button", { name: /Quitar Minha Cota/i });
    expect(payBtn).toBeInTheDocument();

    fireEvent.click(payBtn);
    expect(onOpenSettlementMock).toHaveBeenCalled();
  });

  it("permite alternar filtro de meus gastos e abrir extrato detalhado", () => {
    const onToggleFilterMock = vi.fn();
    const onOpenStatementMock = vi.fn();

    const balance: TripMemberBalance = {
      memberId: "m-bob",
      name: "Bob",
      totalPaidCents: 10000,
      totalOwedCents: 10000,
      netBalanceCents: 0,
    };

    render(
      <TripPersonalContextCard
        trip={trip}
        myMember={memberBob}
        myBalance={balance}
        isHost={false}
        onOpenSettlement={vi.fn()}
        onOpenStatement={onOpenStatementMock}
        isFilterActive={false}
        onToggleFilterMyExpenses={onToggleFilterMock}
      />
    );

    expect(screen.getByText("Zerado")).toBeInTheDocument();

    const filterBtn = screen.getByRole("button", { name: /Ver Meus Gastos/i });
    fireEvent.click(filterBtn);
    expect(onToggleFilterMock).toHaveBeenCalled();

    const statementBtn = screen.getByRole("button", { name: /Meu Extrato/i });
    fireEvent.click(statementBtn);
    expect(onOpenStatementMock).toHaveBeenCalled();
  });

  it("renderiza botão de Sair da Viagem para participante convidado e aciona callback", () => {
    const onLeaveTripMock = vi.fn();

    render(
      <TripPersonalContextCard
        trip={trip}
        myMember={memberBob}
        myBalance={null}
        isHost={false}
        onOpenSettlement={vi.fn()}
        onLeaveTrip={onLeaveTripMock}
      />
    );

    const leaveBtn = screen.getByRole("button", { name: /Sair da Viagem/i });
    expect(leaveBtn).toBeInTheDocument();

    fireEvent.click(leaveBtn);
    expect(onLeaveTripMock).toHaveBeenCalled();
  });
});
