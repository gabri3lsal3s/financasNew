import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManageContributionsDialog } from "./manage-contributions-dialog";
import type { PublicShare } from "@/types";

const mutateAsyncUpdateMock = vi.fn();

vi.mock("@/state", () => ({
  useUpdatePublicShare: () => ({
    mutateAsync: mutateAsyncUpdateMock,
    isPending: false,
  }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("ManageContributionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseShare: PublicShare = {
    id: "share-123",
    user_id: "user-1",
    kind: "goal_tracker",
    token: "tok-abc",
    payload: {
      title: "Viagem de Ano Novo",
      target_cents: 500000,
      current_cents: 150000,
      pix_key: "organizador@pix.com",
      pix_key_type: "email",
      pix_br_code: "BRCODE",
      organizer_name: "Gabriel",
      organizer_city: "SP",
      contributions: [
        {
          id: "c-1",
          amount_cents: 100000,
          contributor_name: "Mariana",
          date: "2026-11-01",
        },
        {
          id: "c-2",
          amount_cents: 50000,
          contributor_name: "Lucas",
          date: "2026-11-02",
        },
      ],
    },
    is_revoked: false,
    expires_at: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  };

  it("renderiza a lista de contribuições e valores corretos", () => {
    render(
      <ManageContributionsDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
      />
    );

    expect(screen.getByText("Gestão de Arrecadações & Participantes")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.getByText("2 depósitos")).toBeInTheDocument();
  });

  it("permite entrar em modo de edição e salvar novo nome e valor", async () => {
    const user = userEvent.setup();
    mutateAsyncUpdateMock.mockResolvedValue({});

    render(
      <ManageContributionsDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
      />
    );

    // Clica no botão de editar da Mariana
    const editBtn = screen.getByRole("button", { name: "Editar depósito de Mariana" });
    await user.click(editBtn);

    expect(screen.getByText("Editar Depósito")).toBeInTheDocument();

    // Altera nome
    const nameInput = screen.getByPlaceholderText("Nome ou Anônimo");
    await user.clear(nameInput);
    await user.type(nameInput, "Mariana Silva");

    // Salva
    const saveBtn = screen.getByRole("button", { name: "Salvar Alterações" });
    await user.click(saveBtn);

    expect(mutateAsyncUpdateMock).toHaveBeenCalledTimes(1);
    const updatedPayload = mutateAsyncUpdateMock.mock.calls[0]?.[0]?.payload;
    expect(updatedPayload.contributions[0].contributor_name).toBe("Mariana Silva");
    expect(updatedPayload.current_cents).toBe(150000);
  });

  it("permite excluir uma contribuição e recalcula o total", async () => {
    const user = userEvent.setup();
    mutateAsyncUpdateMock.mockResolvedValue({});

    render(
      <ManageContributionsDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
      />
    );

    // Clica no botão de excluir de Lucas
    const deleteBtn = screen.getByRole("button", { name: "Excluir depósito de Lucas" });
    await user.click(deleteBtn);

    expect(screen.getByText("Excluir Depósito da Meta?")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirmar Exclusão" });
    await user.click(confirmBtn);

    expect(mutateAsyncUpdateMock).toHaveBeenCalledTimes(1);
    const updatedPayload = mutateAsyncUpdateMock.mock.calls[0]?.[0]?.payload;
    expect(updatedPayload.contributions).toHaveLength(1);
    expect(updatedPayload.contributions[0].contributor_name).toBe("Mariana");
    // Novo total passa a ser 100000 em vez de 150000
    expect(updatedPayload.current_cents).toBe(100000);
  });
});
