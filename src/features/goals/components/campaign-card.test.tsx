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

  it("dispara onManageShare ao clicar no card da meta para abrir o modal de gerenciamento", () => {
    const handleManageShare = vi.fn();
    render(
      <CampaignCard
        share={mockShare}
        onOpenDeposit={vi.fn()}
        onManageShare={handleManageShare}
      />,
    );

    const card = screen.getByRole("button", { name: /Gerenciar meta Viagem dos Sonhos/i });
    fireEvent.click(card);

    expect(handleManageShare).toHaveBeenCalledTimes(1);
    expect(handleManageShare).toHaveBeenCalledWith(mockShare);
  });

  it("dispara onOpenDeposit ao clicar em Depósito sem disparar onManageShare", () => {
    const handleOpenDeposit = vi.fn();
    const handleManageShare = vi.fn();
    render(
      <CampaignCard
        share={mockShare}
        onOpenDeposit={handleOpenDeposit}
        onManageShare={handleManageShare}
      />,
    );

    const depositBtn = screen.getByRole("button", { name: /Depósito/i });
    fireEvent.click(depositBtn);

    expect(handleOpenDeposit).toHaveBeenCalledTimes(1);
    expect(handleOpenDeposit).toHaveBeenCalledWith(mockShare);
    expect(handleManageShare).not.toHaveBeenCalled();
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
