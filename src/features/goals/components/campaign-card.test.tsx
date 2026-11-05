import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CampaignCard } from "./campaign-card";
import type { PublicShare } from "@/types";

describe("CampaignCard", () => {
  const mockShare: PublicShare = {
    id: "share-123",
    user_id: "user-1",
    kind: "goal_tracker",
    token: "gt_token_abc",
    payload: {
      title: "Viagem dos Sonhos",
      target_cents: 100000,
      current_cents: 25000,
      deadline: "2026-12-31",
      show_contributions_publicly: true,
      contributions: [
        {
          id: "c-1",
          amount_cents: 25000,
          contributor_name: "Gabriel",
          date: "2026-11-01",
        },
      ],
    },
    created_at: "2026-11-01T00:00:00Z",
    expires_at: "2026-12-01T00:00:00Z",
    is_revoked: false,
    updated_at: "2026-11-01T00:00:00Z",
  };

  it("renderiza título, progresso e botões principais", () => {
    render(
      <CampaignCard
        share={mockShare}
        onOpenDeposit={vi.fn()}
        onManageShare={vi.fn()}
      />,
    );

    expect(screen.getByText("Viagem dos Sonhos")).toBeInTheDocument();
    expect(screen.getByText("Em Arrecadação")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("dispara onEditShare ao clicar no botão de edição", () => {
    const handleEditShare = vi.fn();
    render(
      <CampaignCard
        share={mockShare}
        onOpenDeposit={vi.fn()}
        onManageShare={vi.fn()}
        onEditShare={handleEditShare}
      />,
    );

    const editBtn = screen.getByRole("button", { name: /Editar parâmetros da meta/i });
    fireEvent.click(editBtn);

    expect(handleEditShare).toHaveBeenCalledTimes(1);
    expect(handleEditShare).toHaveBeenCalledWith(mockShare);
  });

  it("dispara onDeleteShare ao clicar no botão de exclusão", () => {
    const handleDeleteShare = vi.fn();
    render(
      <CampaignCard
        share={mockShare}
        onOpenDeposit={vi.fn()}
        onManageShare={vi.fn()}
        onDeleteShare={handleDeleteShare}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: /Excluir meta/i });
    fireEvent.click(deleteBtn);

    expect(handleDeleteShare).toHaveBeenCalledTimes(1);
    expect(handleDeleteShare).toHaveBeenCalledWith(mockShare);
  });

  it("exibe badge de Link Desativado quando is_revoked for true", () => {
    const revokedShare: PublicShare = {
      ...mockShare,
      is_revoked: true,
    };

    render(
      <CampaignCard
        share={revokedShare}
        onOpenDeposit={vi.fn()}
        onManageShare={vi.fn()}
      />,
    );

    expect(screen.getByText("Link Desativado")).toBeInTheDocument();
  });
});
