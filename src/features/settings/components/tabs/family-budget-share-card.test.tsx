import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyBudgetShareCard } from "./family-budget-share-card";
import * as publicShareQueries from "@/state/queries/use-public-shares";
import * as publicShareMutations from "@/state/mutations/use-public-share-mutations";
import * as toastService from "@/services/toast";
import * as sensoryService from "@/services/sensory";
import type { PublicShare } from "@/types";

let mockIsFamilyModeEnabled = true;
const mockToggleFamilyMode = vi.fn().mockResolvedValue(true);
let mockFamilyData: {
  family?: { id: string; name: string; monthly_budget?: number | null };
  currentMember?: { user_id: string; role?: string };
} | null = null;

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/state")>();
  return {
    ...actual,
    useFamilyMode: () => ({
      isFamilyModeEnabled: mockIsFamilyModeEnabled,
      toggleFamilyMode: mockToggleFamilyMode,
      isUpdating: false,
    }),
    useMyFamily: () => ({
      data: mockFamilyData,
      isLoading: false,
    }),
  };
});

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

const mockActiveShare: PublicShare = {
  id: "share-family-123",
  user_id: "user-owner-456",
  kind: "family_budget",
  token: "famtoken99",
  payload: {
    monthly_ceiling_cents: 450000,
  },
  created_at: "2026-11-05T12:00:00Z",
  expires_at: new Date(Date.now() + 864000000).toISOString(),
  is_revoked: false,
  updated_at: "2026-11-05T12:00:00Z",
};

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FamilyBudgetShareCard />
    </QueryClientProvider>,
  );
}

describe("FamilyBudgetShareCard", () => {
  const mockMutateCreate = vi.fn().mockResolvedValue({ id: "new-share-id" });
  const mockMutateRevoke = vi.fn().mockResolvedValue(undefined);
  const mockMutateRegenerate = vi.fn().mockResolvedValue({ id: "regen-share-id" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFamilyModeEnabled = true;
    mockFamilyData = null;

    vi.spyOn(publicShareMutations, "useCreatePublicShare").mockReturnValue({
      mutateAsync: mockMutateCreate,
      isPending: false,
    } as unknown as ReturnType<typeof publicShareMutations.useCreatePublicShare>);

    vi.spyOn(publicShareMutations, "useRevokePublicShare").mockReturnValue({
      mutateAsync: mockMutateRevoke,
      isPending: false,
    } as unknown as ReturnType<typeof publicShareMutations.useRevokePublicShare>);

    vi.spyOn(publicShareMutations, "useRegeneratePublicShare").mockReturnValue({
      mutateAsync: mockMutateRegenerate,
      isPending: false,
    } as unknown as ReturnType<typeof publicShareMutations.useRegeneratePublicShare>);
  });

  it("renderiza switch do modo familiar e permite alternar", async () => {
    const user = userEvent.setup();
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    renderCard();

    const toggle = screen.getByRole("switch", { name: "Habilitar Modo Familiar" });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(mockToggleFamilyMode).toHaveBeenCalledWith(false);
  });

  it("renderiza estado calmo com aviso quando modo familiar estiver desativado", () => {
    mockIsFamilyModeEnabled = false;
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [mockActiveShare],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    renderCard();

    expect(screen.getByText("Modo Desativado")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Ao desativar o modo familiar, todas as transações continuam disponíveis de forma consolidada/i,
      ),
    ).toBeInTheDocument();
    // O link não deve aparecer quando desativado
    expect(screen.queryByText("Link Exclusivo de Leitura")).not.toBeInTheDocument();
  });

  it("renderiza estado sem link ativo quando não houver compartilhamentos", () => {
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    renderCard();

    expect(screen.getByText("Orçamento Familiar & Link do Cônjuge")).toBeInTheDocument();
    expect(screen.getByText("Sem Link Ativo")).toBeInTheDocument();
    expect(screen.getByText("Nenhum link familiar ativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar Link Familiar" })).toBeInTheDocument();
  });

  it("permite abrir modal e gerar novo link familiar", async () => {
    const user = userEvent.setup();
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    renderCard();

    await user.click(screen.getByRole("button", { name: "Gerar Link Familiar" }));

    expect(screen.getByText("Gerar Link de Orçamento Familiar")).toBeInTheDocument();
    expect(screen.getByText("Privacidade Garantida")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Gerar Link" });
    await user.click(submitBtn);

    expect(mockMutateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "family_budget",
      }),
    );
  });

  it("renderiza link ativo e permite copiar a URL", async () => {
    const user = userEvent.setup();
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [mockActiveShare],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    renderCard();

    expect(screen.getByText("Link Ativo")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/orcamento-familiar\/famtoken99/)).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /Copiar Link/i });
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("famtoken99"));
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Link copiado para a área de transferência!",
      }),
    );
    expect(sensoryService.triggerSensory).toHaveBeenCalledWith("success");
  });

  it("permite revogar o link familiar ativo com confirmação em modal", async () => {
    const user = userEvent.setup();
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [mockActiveShare],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    renderCard();

    const revokeBtn = screen.getByRole("button", { name: "Revogar Acesso" });
    await user.click(revokeBtn);

    expect(screen.getByText("Revogar Link Familiar")).toBeInTheDocument();
    expect(
      screen.getByText("Tem certeza de que deseja revogar o link do orçamento familiar?"),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirmar Revogação" });
    await user.click(confirmBtn);

    expect(mockMutateRevoke).toHaveBeenCalledWith("share-family-123");
  });

  it("permite regenerar o link familiar com confirmação em modal", async () => {
    const user = userEvent.setup();
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [mockActiveShare],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    renderCard();

    const regenBtn = screen.getByRole("button", { name: "Regenerar Link" });
    await user.click(regenBtn);

    expect(screen.getByText("Regenerar Novo Link")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Regenerar Novo Link" });
    await user.click(confirmBtn);

    expect(mockMutateRegenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        oldId: "share-family-123",
        input: expect.objectContaining({
          kind: "family_budget",
        }),
      }),
    );
  });

  it("oculta campo de teto manual e vincula teto da casa quando usuário pertence a um grupo familiar", async () => {
    const user = userEvent.setup();
    mockFamilyData = {
      family: { id: "fam-1", name: "Família Silva", monthly_budget: 5000 },
      currentMember: { user_id: "user-2", role: "member" },
    };
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    renderCard();

    await user.click(screen.getByRole("button", { name: "Gerar Link Familiar" }));

    expect(screen.getByText("Teto Vinculado ao Grupo Familiar")).toBeInTheDocument();
    expect(screen.getByText(/O link herdará automaticamente o teto estabelecido para o seu lar/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Teto mensal personalizado/i)).not.toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Gerar Link" });
    await user.click(submitBtn);

    // Quando pertence a uma família, o payload não deve conter monthly_ceiling_cents
    expect(mockMutateCreate).toHaveBeenCalledWith({
      kind: "family_budget",
      payload: {},
    });
  });

  it("renderiza indicação de teto da casa vinculado no card de link ativo quando pertence a uma família", () => {
    mockFamilyData = {
      family: { id: "fam-1", name: "Família Silva", monthly_budget: 5000 },
      currentMember: { user_id: "user-2", role: "member" },
    };
    vi.spyOn(publicShareQueries, "useMyPublicShares").mockReturnValue({
      data: [mockActiveShare],
      isLoading: false,
    } as unknown as ReturnType<typeof publicShareQueries.useMyPublicShares>);

    renderCard();

    expect(screen.getByText(/Teto da casa vinculado:/i)).toBeInTheDocument();
    expect(screen.getByText("R$ 5.000,00")).toBeInTheDocument();
  });
});
