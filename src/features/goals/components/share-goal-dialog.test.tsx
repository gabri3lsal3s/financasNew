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
const mutateAsyncRevokeMock = vi.fn();
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
  useRevokePublicShare: () => ({
    mutateAsync: mutateAsyncRevokeMock,
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

  it("permite revogar link ativo com confirmação em modal dedicado", async () => {
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

    const revokeBtn = screen.getByRole("button", { name: /Revogar link/i });
    fireEvent.click(revokeBtn);

    expect(screen.getByText("Revogar Link do Termômetro")).toBeInTheDocument();

    const confirmRevokeBtn = screen.getByRole("button", { name: "Confirmar revogação" });
    fireEvent.click(confirmRevokeBtn);

    await waitFor(() => {
      expect(mutateAsyncRevokeMock).toHaveBeenCalledWith("share-to-revoke");
    });
  });
});
