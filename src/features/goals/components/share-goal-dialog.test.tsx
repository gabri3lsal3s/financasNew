import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareGoalDialog } from "./share-goal-dialog";
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

const mutateAsyncCreateMock = vi.fn();
const mutateAsyncUpdateMock = vi.fn();
const mutateAsyncRevokeMock = vi.fn();
const mutateAsyncRestoreMock = vi.fn();
const mutateAsyncDeleteMock = vi.fn();
const mutateAsyncRegenerateMock = vi.fn();
let mockMyShares: PublicShare[] = [];

vi.mock("@/state/queries/use-user-access", () => ({
  useUserAccess: () => ({
    profile: {
      name: "Gabriel Sales",
      cpf: "123.456.789-00",
      email: "gabriel@axis.app",
    },
  }),
}));

vi.mock("@/state/queries/use-public-shares", () => ({
  useMyPublicShares: () => ({
    data: mockMyShares,
    isLoading: false,
  }),
}));

vi.mock("@/state/mutations/use-public-share-mutations", () => ({
  useCreatePublicShare: () => ({
    mutateAsync: mutateAsyncCreateMock,
    isPending: false,
  }),
  useUpdatePublicShare: () => ({
    mutateAsync: mutateAsyncUpdateMock,
    isPending: false,
  }),
  useRevokePublicShare: () => ({
    mutateAsync: mutateAsyncRevokeMock,
    isPending: false,
  }),
  useRestorePublicShare: () => ({
    mutateAsync: mutateAsyncRestoreMock,
    isPending: false,
  }),
  useDeletePublicShare: () => ({
    mutateAsync: mutateAsyncDeleteMock,
    isPending: false,
  }),
  useRegeneratePublicShare: () => ({
    mutateAsync: mutateAsyncRegenerateMock,
    isPending: false,
  }),
}));

describe("ShareGoalDialog", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMyShares = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
  });

  it("renderiza formulário de criação com campos pré-preenchidos a partir do perfil e meta", () => {
    render(
      <ShareGoalDialog
        open={true}
        onOpenChange={vi.fn()}
        category={mockCategory}
        month="2026-11"
        currentExpectedCents={600000}
        currentRealizedCents={420000}
      />,
    );

    expect(screen.getByText("Compartilhar Progresso da Meta")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Viagem de Fim de Ano")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123.456.789-00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Gabriel Sales")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Gerar Termômetro Público & Copiar Link/ }),
    ).toBeInTheDocument();
  });

  it("gera o termômetro público com chave Pix BACEN e copia o link gerado", async () => {
    mutateAsyncCreateMock.mockResolvedValueOnce({
      id: "share-new",
      token: "gt_token123",
      kind: "goal_tracker",
      payload: {},
    });

    render(
      <ShareGoalDialog
        open={true}
        onOpenChange={vi.fn()}
        category={mockCategory}
        month="2026-11"
        currentExpectedCents={500000}
        currentRealizedCents={250000}
      />,
    );

    const submitBtn = screen.getByRole("button", {
      name: /Gerar Termômetro Público & Copiar Link/,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncCreateMock).toHaveBeenCalledTimes(1);
    });

    const createArg = mutateAsyncCreateMock.mock.calls[0]?.[0];
    expect(createArg.kind).toBe("goal_tracker");
    expect(createArg.payload.title).toBe("Viagem de Fim de Ano");
    expect(createArg.payload.category_id).toBe("cat-1");
    expect(createArg.payload.target_cents).toBe(500000);
    expect(createArg.payload.pix_key).toBe("123.456.789-00");
    expect(createArg.payload.pix_br_code).toContain("000201"); // Prefixo BACEN EMV

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/meta/gt_token123"),
      );
    });
  });

  it("exibe informações do link ativo, botão de cópia e ações quando o compartilhamento já existe", async () => {
    mockMyShares = [
      {
        id: "share-existing",
        user_id: "user-1",
        kind: "goal_tracker",
        token: "gt_active_link",
        payload: {
          category_id: "cat-1",
          title: "Viagem Coletiva 2026",
          target_cents: 800000,
          current_cents: 400000,
          pix_key: "123.456.789-00",
          pix_br_code: "000201...",
        },
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-12-01T00:00:00Z",
        is_revoked: false,
        updated_at: "2026-11-01T00:00:00Z",
      },
    ];

    render(
      <ShareGoalDialog
        open={true}
        onOpenChange={vi.fn()}
        category={mockCategory}
        month="2026-11"
        currentExpectedCents={800000}
        currentRealizedCents={400000}
      />,
    );

    expect(screen.getByText("Termômetro Público Ativo")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\/meta\/gt_active_link/)).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: "Copiar link do termômetro" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/meta/gt_active_link"),
      );
      expect(screen.getByText("Copiado")).toBeInTheDocument();
    });
  });

  it("permite pausar link ativo com confirmação em modal dedicado", async () => {
    mockMyShares = [
      {
        id: "share-to-revoke",
        user_id: "user-1",
        kind: "goal_tracker",
        token: "gt_active_link",
        payload: {
          category_id: "cat-1",
          title: "Meta para Revogar",
          target_cents: 300000,
          pix_key: "123.456.789-00",
        },
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-12-01T00:00:00Z",
        is_revoked: false,
        updated_at: "2026-11-01T00:00:00Z",
      },
    ];

    render(
      <ShareGoalDialog
        open={true}
        onOpenChange={vi.fn()}
        category={mockCategory}
        month="2026-11"
      />,
    );

    const pauseBtn = screen.getByRole("button", { name: /Pausar link público/i });
    fireEvent.click(pauseBtn);

    expect(screen.getByText("Pausar Link do Termômetro")).toBeInTheDocument();

    const confirmPauseBtn = screen.getByRole("button", { name: "Pausar link" });
    fireEvent.click(confirmPauseBtn);

    await waitFor(() => {
      expect(mutateAsyncRevokeMock).toHaveBeenCalledWith("share-to-revoke");
    });
  });

  it("permite excluir permanentemente a meta de arrecadação pelo anfitrião", async () => {
    const handleOpenChange = vi.fn();
    mockMyShares = [
      {
        id: "share-to-delete",
        user_id: "user-1",
        kind: "goal_tracker",
        token: "gt_delete_link",
        payload: {
          title: "Meta para Excluir",
          target_cents: 500000,
          pix_key: "123.456.789-00",
        },
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-12-01T00:00:00Z",
        is_revoked: false,
        updated_at: "2026-11-01T00:00:00Z",
      },
    ];

    render(
      <ShareGoalDialog
        open={true}
        onOpenChange={handleOpenChange}
        existingShare={mockMyShares[0]}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: /Excluir meta/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Excluir Meta de Arrecadação?")).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: "Excluir Meta" });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mutateAsyncDeleteMock).toHaveBeenCalledWith("share-to-delete");
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("permite reativar link público previamente pausado", async () => {
    mockMyShares = [
      {
        id: "share-revoked",
        user_id: "user-1",
        kind: "goal_tracker",
        token: "gt_paused_link",
        payload: {
          title: "Meta Pausada",
          target_cents: 500000,
          pix_key: "123.456.789-00",
        },
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-12-01T00:00:00Z",
        is_revoked: true,
        updated_at: "2026-11-01T00:00:00Z",
      },
    ];

    render(
      <ShareGoalDialog
        open={true}
        onOpenChange={vi.fn()}
        existingShare={mockMyShares[0]}
      />,
    );

    expect(screen.getByText("Link Público Pausado")).toBeInTheDocument();

    const restoreBtn = screen.getByRole("button", { name: /Reativar link público/i });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(mutateAsyncRestoreMock).toHaveBeenCalledWith("share-revoked");
    });
  });

  it("permite abrir diretamente em modo de edição e atualizar todos os parâmetros da meta", async () => {
    const existingShare: PublicShare = {
      id: "share-to-edit",
      user_id: "user-1",
      kind: "goal_tracker",
      token: "gt_edit_link",
      payload: {
        title: "Viagem Antiga",
        target_cents: 100000,
        current_cents: 20000,
        deadline: "2026-12-31",
        pix_key: "123.456.789-00",
        show_contributions_publicly: true,
      },
      created_at: "2026-11-01T00:00:00Z",
      expires_at: "2026-12-01T00:00:00Z",
      is_revoked: false,
      updated_at: "2026-11-01T00:00:00Z",
    };

    render(
      <ShareGoalDialog
        open={true}
        onOpenChange={vi.fn()}
        existingShare={existingShare}
        initialEditMode={true}
      />,
    );

    expect(screen.getByText("Editando Parâmetros da Meta")).toBeInTheDocument();

    // Título e valor arrecadado editáveis
    const titleInput = screen.getByDisplayValue("Viagem Antiga");
    fireEvent.change(titleInput, { target: { value: "Viagem Renovada 2027" } });

    const saveBtn = screen.getByRole("button", { name: /^Salvar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mutateAsyncUpdateMock).toHaveBeenCalledWith({
        id: "share-to-edit",
        payload: expect.objectContaining({
          title: "Viagem Renovada 2027",
          current_cents: 20000,
          deadline: "2026-12-31",
        }),
      });
    });
  });

  it("renderiza rodapé responsivo com ações compactas e botão de concluir/reabrir sem cortes", () => {
    mockMyShares = [
      {
        id: "share-active",
        user_id: "user-1",
        kind: "goal_tracker",
        token: "gt_active",
        payload: {
          title: "Meta Ativa",
          target_cents: 100000,
          current_cents: 100000,
          pix_key: "gabriel@axis.app",
        },
        created_at: "2026-11-01T00:00:00Z",
        expires_at: "2026-12-01T00:00:00Z",
        is_revoked: false,
        updated_at: "2026-11-01T00:00:00Z",
      },
    ];

    render(
      <ShareGoalDialog
        open={true}
        onOpenChange={vi.fn()}
        existingShare={mockMyShares[0]}
        currentRealizedCents={100000}
        currentExpectedCents={100000}
      />,
    );

    // Botões utilitários no rodapé
    expect(screen.getByRole("button", { name: "Excluir meta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar link público" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerar link público" })).toBeInTheDocument();

    // Botões de diálogo no rodapé
    expect(screen.getAllByRole("button", { name: "Fechar" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Marcar como concluída" })).toBeInTheDocument();
  });
});



