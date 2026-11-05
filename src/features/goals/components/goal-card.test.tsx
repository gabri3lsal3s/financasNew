import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GoalCard } from "./goal-card";
import type { Category, PublicShare } from "@/types";

const mockCategory: Category = {
  id: "cat-1",
  user_id: "user-1",
  name: "Viagem de Fim de Ano",
  icon: "viagem",
  color: "#3B82F6",
  type: "income",
  is_reserved: false,
  is_active: true,
};

describe("GoalCard", () => {
  it("renderiza nome da categoria, valores em centavos e percentual atingido", () => {
    render(
      <GoalCard
        category={mockCategory}
        month="2026-11"
        realizedCents={420000}
        expectedCents={600000}
        status="on_track"
        percent={70}
        onOpenGoal={vi.fn()}
        onEditCategory={vi.fn()}
        onShareGoal={vi.fn()}
      />,
    );

    expect(screen.getByText("Viagem de Fim de Ano")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("Na meta")).toBeInTheDocument();
  });

  it("chama onOpenGoal ao clicar no cabeçalho ou barra de progresso", async () => {
    const user = userEvent.setup();
    const onOpenGoal = vi.fn();

    render(
      <GoalCard
        category={mockCategory}
        month="2026-11"
        realizedCents={200000}
        expectedCents={500000}
        status="deficit"
        percent={40}
        onOpenGoal={onOpenGoal}
        onEditCategory={vi.fn()}
        onShareGoal={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button", {
      name: "Editar meta de renda de Viagem de Fim de Ano",
    });
    await user.click(buttons[0]!);
    expect(onOpenGoal).toHaveBeenCalledWith(mockCategory);
  });

  it("chama onEditCategory ao clicar no botão de editar cadastro", async () => {
    const user = userEvent.setup();
    const onEditCategory = vi.fn();

    render(
      <GoalCard
        category={mockCategory}
        month="2026-11"
        realizedCents={0}
        expectedCents={0}
        status="deficit"
        percent={0}
        onOpenGoal={vi.fn()}
        onEditCategory={onEditCategory}
        onShareGoal={vi.fn()}
      />,
    );

    const editBtn = screen.getByRole("button", {
      name: "Editar cadastro de Viagem de Fim de Ano",
    });
    await user.click(editBtn);
    expect(onEditCategory).toHaveBeenCalledWith(mockCategory);
  });

  it("chama onShareGoal ao clicar no botão de compartilhar progresso da meta", async () => {
    const user = userEvent.setup();
    const onShareGoal = vi.fn();

    render(
      <GoalCard
        category={mockCategory}
        month="2026-11"
        realizedCents={100000}
        expectedCents={200000}
        status="on_track"
        percent={50}
        onOpenGoal={vi.fn()}
        onEditCategory={vi.fn()}
        onShareGoal={onShareGoal}
      />,
    );

    const shareBtn = screen.getByRole("button", {
      name: "Compartilhar progresso da meta Viagem de Fim de Ano",
    });
    await user.click(shareBtn);
    expect(onShareGoal).toHaveBeenCalledWith(mockCategory);
  });

  it("exibe badge de meta pública quando activeShare válido estiver presente", async () => {
    const user = userEvent.setup();
    const onShareGoal = vi.fn();

    const activeShare: PublicShare = {
      id: "share-1",
      user_id: "user-1",
      kind: "goal_tracker",
      token: "gt_abc123",
      payload: { title: "Viagem de Fim de Ano" },
      created_at: "2026-11-01T00:00:00Z",
      expires_at: "2026-12-01T00:00:00Z",
      is_revoked: false,
      updated_at: "2026-11-01T00:00:00Z",
    };

    render(
      <GoalCard
        category={mockCategory}
        month="2026-11"
        realizedCents={300000}
        expectedCents={500000}
        status="on_track"
        percent={60}
        activeShare={activeShare}
        onOpenGoal={vi.fn()}
        onEditCategory={vi.fn()}
        onShareGoal={onShareGoal}
      />,
    );

    const publicBadge = screen.getByText("Pública");
    expect(publicBadge).toBeInTheDocument();

    await user.click(publicBadge);
    expect(onShareGoal).toHaveBeenCalledWith(mockCategory);
  });

  it("não exibe badge de meta pública se o link estiver revogado ou expirado", () => {
    const revokedShare: PublicShare = {
      id: "share-2",
      user_id: "user-1",
      kind: "goal_tracker",
      token: "gt_revoked",
      payload: {},
      created_at: "2026-11-01T00:00:00Z",
      expires_at: "2026-12-01T00:00:00Z",
      is_revoked: true,
      updated_at: "2026-11-01T00:00:00Z",
    };

    render(
      <GoalCard
        category={mockCategory}
        month="2026-11"
        realizedCents={300000}
        expectedCents={500000}
        status="on_track"
        percent={60}
        activeShare={revokedShare}
        onOpenGoal={vi.fn()}
        onEditCategory={vi.fn()}
        onShareGoal={vi.fn()}
      />,
    );

    expect(screen.queryByText("Pública")).not.toBeInTheDocument();
  });
});
