import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Trip } from "@/types/trips";
import { ActiveTripBanner } from "./active-trip-banner";

const baseTrip: Trip = {
  id: "trip-1",
  host_user_id: "user-1",
  title: "Feriado em Paraty",
  destination: "Paraty, RJ",
  start_date: "2026-11-15",
  end_date: "2026-11-18",
  status: "active",
  currency: "BRL",
  public_token: "tok-paraty",
  passcode_hash: null,
  cover_photo_url: null,
  created_at: "",
  updated_at: "",
};

describe("ActiveTripBanner", () => {
  it("renderiza período formatado quando totalExpensesCents não é informado", () => {
    render(
      <MemoryRouter>
        <ActiveTripBanner trip={baseTrip} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Feriado em Paraty")).toBeInTheDocument();
    expect(screen.getByText("Viagem Ativa")).toBeInTheDocument();
    expect(screen.getByText("15/11/2026 até 18/11/2026")).toBeInTheDocument();
    const actionBtn = screen.getByRole("button", { name: /Acessar Viagem/i });
    expect(actionBtn).toBeInTheDocument();
  });

  it("renderiza Total gasto com MoneyText quando totalExpensesCents é informado", () => {
    render(
      <MemoryRouter>
        <ActiveTripBanner trip={baseTrip} totalExpensesCents={45000} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Total gasto:")).toBeInTheDocument();
    const amountEl = screen.getByText("R$ 450,00");
    expect(amountEl).toBeInTheDocument();
    expect(amountEl).toHaveClass("num");
    expect(amountEl).not.toHaveClass("truncate");
  });

  it("permite dispensar o aviso de viagem ativa por 7 ou 30 dias", () => {
    const onDismiss = vi.fn();
    render(
      <MemoryRouter>
        <ActiveTripBanner trip={baseTrip} onDismiss={onDismiss} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Dispensar aviso de viagem ativa/i }));
    fireEvent.click(screen.getByRole("button", { name: /7 dias/i }));
    expect(onDismiss).toHaveBeenCalledWith(7);
  });
});
