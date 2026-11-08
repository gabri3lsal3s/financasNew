import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoalProgressAlertBanner } from "./goal-progress-alert-banner";
import type { PublicShare } from "@/types";

const mockGoalShare: PublicShare = {
  id: "share-1",
  user_id: "user-1",
  kind: "goal_tracker",
  token: "tok-1",
  expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  is_revoked: false,
  payload: {
    title: "Viagem dos Sonhos",
    target_cents: 100000,
    current_cents: 85000,
    status: "in_progress",
  },
};

describe("GoalProgressAlertBanner", () => {
  it("renderiza reta final com botão + Aportar e Ver Meta", () => {
    const handleDeposit = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <GoalProgressAlertBanner
        goalShare={mockGoalShare}
        onOpenDeposit={handleDeposit}
        onNavigateGoals={handleNavigate}
      />,
    );

    expect(screen.getByText("Reta Final: Viagem dos Sonhos")).toBeInTheDocument();
    expect(screen.getByText("85% alcançado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Aportar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver Meta/i })).toBeInTheDocument();
  });

  it("renderiza Meta Conquistada quando 100% batido sem botão + Aportar", () => {
    const completedShare: PublicShare = {
      ...mockGoalShare,
      payload: {
        ...mockGoalShare.payload,
        current_cents: 100000,
        status: "completed",
      },
    };

    render(
      <GoalProgressAlertBanner
        goalShare={completedShare}
        onOpenDeposit={vi.fn()}
        onNavigateGoals={vi.fn()}
      />,
    );

    expect(screen.getByText("Meta Conquistada: Viagem dos Sonhos")).toBeInTheDocument();
    expect(screen.getByText("100% Batido")).toBeInTheDocument();
    expect(screen.getByText(/Parabéns! Você alcançou o valor planejado com sucesso/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ Aportar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver Meta/i })).toBeInTheDocument();
  });

  it("renderiza botão de descarte (X) e chama onDismiss ao clicar", () => {
    const handleDismiss = vi.fn();

    render(
      <GoalProgressAlertBanner
        goalShare={mockGoalShare}
        onOpenDeposit={vi.fn()}
        onNavigateGoals={vi.fn()}
        onDismiss={handleDismiss}
      />,
    );

    const dismissButton = screen.getByRole("button", {
      name: /Dispensar alerta da meta Viagem dos Sonhos/i,
    });
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("não renderiza botão de descarte quando onDismiss não é fornecido", () => {
    render(
      <GoalProgressAlertBanner
        goalShare={mockGoalShare}
        onOpenDeposit={vi.fn()}
        onNavigateGoals={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Dispensar alerta da meta/i }),
    ).not.toBeInTheDocument();
  });
});
