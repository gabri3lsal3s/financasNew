import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SplitPendingBanner } from "./split-pending-banner";

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("SplitPendingBanner", () => {
  it("renderiza valor consolidado, contagem e divisões pendentes", () => {
    const items = [
      {
        id: "s1",
        title: "Churrasco",
        pendingCents: 8000,
        pendingFriendsCount: 2,
        totalFriendsCount: 3,
      },
      {
        id: "s2",
        title: "Pizza",
        pendingCents: 4500,
        pendingFriendsCount: 1,
        totalFriendsCount: 2,
      },
    ];

    render(
      <SplitPendingBanner
        pendingCents={12500}
        activeCount={2}
        totalExpensesCents={25000}
        items={items}
      />,
    );

    expect(screen.getByText("Despesas a Rachar e Receber")).toBeInTheDocument();
    expect(screen.getByText("2 rachas a receber")).toBeInTheDocument();
    expect(screen.getByText(/Total de/i)).toBeInTheDocument();
    expect(screen.getByText(/a receber em reembolsos/i)).toBeInTheDocument();

    // CTA
    const ctaBtn = screen.getByRole("button", { name: /ver e cobrar/i });
    expect(ctaBtn).toBeInTheDocument();
    fireEvent.click(ctaBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes");
  });
});
