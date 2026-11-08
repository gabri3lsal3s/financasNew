import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WeeklyDueRadarCard } from "./weekly-due-radar-card";
import type { WeeklyRadarSummary } from "@/domain/projection";

const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("WeeklyDueRadarCard — Widget dos Próximos 7 Dias", () => {
  it("retorna estritamente null quando hasObligations é false (regra de auto-ocultação em empty state)", () => {
    const emptySummary: WeeklyRadarSummary = {
      items: [],
      totalDueCents: 0,
      realCashCents: 150000,
      freeBalanceCents: 150000,
      isDeficitRisk: false,
      hasObligations: false,
    };

    const { container } = render(<WeeklyDueRadarCard summary={emptySummary} />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza o widget com cabeçalho, indicador de liquidez e itens quando há contas", () => {
    const activeSummary: WeeklyRadarSummary = {
      items: [
        {
          id: "d1",
          key: "debt:d1",
          kind: "debt",
          name: "Internet Fibra",
          dueDate: "2026-08-11",
          amountCents: 12000,
          status: "due_soon",
          daysUntilDue: 1,
          link: { path: "/dividas", params: { q: "d1" } },
        },
        {
          id: "c1",
          key: "bill:c1",
          kind: "bill",
          name: "Fatura Nubank",
          dueDate: "2026-08-12",
          amountCents: 45000,
          status: "due_soon",
          daysUntilDue: 2,
          link: { path: "/cartoes" },
        },
      ],
      totalDueCents: 57000,
      realCashCents: 100000,
      freeBalanceCents: 43000,
      isDeficitRisk: false,
      hasObligations: true,
    };

    render(<WeeklyDueRadarCard summary={activeSummary} />);

    expect(screen.getByText("Próximos 7 Dias")).toBeInTheDocument();
    expect(screen.getByText("2 contas")).toBeInTheDocument();
    expect(screen.getByText("Internet Fibra")).toBeInTheDocument();
    expect(screen.getByText("Fatura Nubank")).toBeInTheDocument();
    expect(screen.getByText("Amanhã")).toBeInTheDocument();
    expect(screen.getByText("Em 2 dias")).toBeInTheDocument();
    expect(screen.getByText("Central de Lembretes")).toBeInTheDocument();
  });

  it("navega para /lembretes ao clicar no botão do rodapé", async () => {
    const user = userEvent.setup();
    const activeSummary: WeeklyRadarSummary = {
      items: [
        {
          id: "d1",
          key: "debt:d1",
          kind: "debt",
          name: "Conta de Luz",
          dueDate: "2026-08-10",
          amountCents: 8500,
          status: "due_today",
          daysUntilDue: 0,
          link: { path: "/dividas" },
        },
      ],
      totalDueCents: 8500,
      realCashCents: 20000,
      freeBalanceCents: 11500,
      isDeficitRisk: false,
      hasObligations: true,
    };

    render(<WeeklyDueRadarCard summary={activeSummary} />);

    await user.click(screen.getByRole("button", { name: /Central de Lembretes/i }));
    expect(navigateMock).toHaveBeenCalledWith("/lembretes");
  });
});
