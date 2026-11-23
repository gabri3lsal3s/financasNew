import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FamilySettingsDialog } from "./family-settings-dialog";
import * as stateModule from "@/state";
import * as sensoryService from "@/services/sensory";

const mockUpdateFamily = vi.fn().mockResolvedValue({});
const mockUpdateMember = vi.fn().mockResolvedValue({});
const mockInviteMember = vi.fn().mockResolvedValue({ token: "inv-tok-1" });
const mockRevokeInvite = vi.fn().mockResolvedValue(undefined);
const mockRemoveMember = vi.fn().mockResolvedValue({});
const mockLeaveFamily = vi.fn().mockResolvedValue({ disbanded: false });
const mockDeleteFamily = vi.fn().mockResolvedValue({ disbanded: true });

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("./budget-share", () => ({
  FamilyBudgetShareCard: () => <div data-testid="mock-family-budget-share-card" />,
}));

const mockFamilyState = {
  family: {
    id: "fam-1",
    name: "Família Silva",
    owner_id: "user-1",
    monthly_budget: 6000,
    split_rule: "equal" as const,
  },
  currentMember: {
    id: "mem-1",
    family_id: "fam-1",
    user_id: "user-1",
    role: "owner" as const,
    display_name: "Gabriel",
    pix_key: "gabriel@pix.com",
    pix_key_type: "email" as const,
    split_ratio: 0.5,
  },
  members: [
    {
      id: "mem-1",
      family_id: "fam-1",
      user_id: "user-1",
      role: "owner" as const,
      display_name: "Gabriel",
      profile_name: "Gabriel",
      pix_key: "gabriel@pix.com",
      pix_key_type: "email" as const,
      split_ratio: 0.5,
    },
    {
      id: "mem-2",
      family_id: "fam-1",
      user_id: "user-2",
      role: "member" as const,
      display_name: "Ana",
      profile_name: "Ana",
      pix_key: null,
      pix_key_type: null,
      split_ratio: 0.5,
    },
  ],
  invites: [
    {
      id: "inv-1",
      family_id: "fam-1",
      token: "tok-123",
      invited_email: "carlos@exemplo.com",
      status: "pending" as const,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
  ],
};

function renderDialog(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FamilySettingsDialog open={true} onOpenChange={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe("FamilySettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(stateModule, "useMyFamily").mockReturnValue({
      data: mockFamilyState,
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.useMyFamily>);
    vi.spyOn(stateModule, "useFamilyIncomeRatioSuggestion").mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof stateModule.useFamilyIncomeRatioSuggestion>);
    vi.spyOn(stateModule, "useUpdateFamily").mockReturnValue({
      mutateAsync: mockUpdateFamily,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpdateFamily>);
    vi.spyOn(stateModule, "useUpdateFamilyMember").mockReturnValue({
      mutateAsync: mockUpdateMember,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpdateFamilyMember>);
    vi.spyOn(stateModule, "useInviteFamilyMember").mockReturnValue({
      mutateAsync: mockInviteMember,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useInviteFamilyMember>);
    vi.spyOn(stateModule, "useRevokeFamilyInvite").mockReturnValue({
      mutateAsync: mockRevokeInvite,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useRevokeFamilyInvite>);
    vi.spyOn(stateModule, "useRemoveFamilyMember").mockReturnValue({
      mutateAsync: mockRemoveMember,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useRemoveFamilyMember>);
    vi.spyOn(stateModule, "useLeaveFamily").mockReturnValue({
      mutateAsync: mockLeaveFamily,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useLeaveFamily>);
    vi.spyOn(stateModule, "useDeleteFamily").mockReturnValue({
      mutateAsync: mockDeleteFamily,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useDeleteFamily>);
  });

  it("exige confirmação via ConfirmDialog ao revogar convite pendente e usa aria-label acessível", async () => {
    const user = userEvent.setup();
    renderDialog({ initialTab: "members" });

    const revokeBtn = screen.getByRole("button", {
      name: "Revogar convite de carlos@exemplo.com",
    });
    await user.click(revokeBtn);

    // Ainda não deve ter revogado antes da confirmação
    expect(mockRevokeInvite).not.toHaveBeenCalled();
    expect(screen.getByText("Revogar Convite Pendente")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirmar Revogação" });
    await user.click(confirmBtn);

    expect(mockRevokeInvite).toHaveBeenCalledWith("inv-1");
  });

  it("não dispara feedback sensorial duplicado no botão Salvar Parâmetros", async () => {
    const user = userEvent.setup();
    renderDialog();

    const nameInput = screen.getByLabelText(/Nome da Família/i);
    expect(nameInput.className).toContain("text-base");
    await user.clear(nameInput);
    await user.type(nameInput, "Casa Nova");

    await user.click(screen.getByRole("button", { name: "Salvar Parâmetros" }));

    expect(mockUpdateFamily).toHaveBeenCalledTimes(1);
    expect(sensoryService.triggerSensory).not.toHaveBeenCalled();
  });

  it("exibe calculadora na aba Regras da Casa para o titular e confirmação elevada ao remover membro", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole("button", { name: "Abrir calculadora" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Membros/i }));
    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(screen.getByText("Remover Membro da Família")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar Remoção" }));

    expect(mockRemoveMember).toHaveBeenCalledWith({
      familyId: "fam-1",
      targetUserId: "user-2",
    });
  });

  it("salva a Regra de Divisão dos Gastos imediatamente ao alterar a opção no seletor", async () => {
    const user = userEvent.setup();
    renderDialog();

    const selectTrigger = screen.getByRole("combobox", { name: "Regra de rateio familiar" });
    await user.click(selectTrigger);

    const option = await screen.findByRole("option", { name: /Finanças Conjuntas/i });
    await user.click(option);

    expect(mockUpdateFamily).toHaveBeenCalledWith({
      familyId: "fam-1",
      updates: {
        split_rule: "combined",
      },
    });
    expect(sensoryService.triggerSensory).toHaveBeenCalledWith("selection");
  });

  it("intercepta o fechamento do modal e exibe confirm de descarte quando há alterações no nome da família", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    const nameInput = screen.getByLabelText(/Nome da Família/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Nome Modificado Não Salvo");

    // Tenta fechar o modal clicando no botão Fechar
    const closeButtons = screen.getAllByRole("button", { name: "Fechar" });
    const closeBtn = closeButtons[0];
    expect(closeBtn).toBeDefined();
    if (closeBtn) await user.click(closeBtn);

    // Não fecha diretamente
    expect(onOpenChange).not.toHaveBeenCalled();

    // Exibe diálogo de confirmação de descarte
    expect(screen.getByText("Descartar alterações?")).toBeInTheDocument();

    // Confirma descarte
    const discardBtn = screen.getByRole("button", { name: "Descartar" });
    await user.click(discardBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("não entra em loop de re-renders quando montado fechado (open=false)", () => {
    expect(() => {
      renderDialog({ open: false });
    }).not.toThrow();
  });

  it("valida e salva chave Pix com detecção automática na aba Meus Dados & Pix", async () => {
    const user = userEvent.setup();
    renderDialog({ initialTab: "pix" });

    const pixInput = screen.getByLabelText(/Sua Chave Pix/i);
    expect(pixInput).toHaveValue("gabriel@pix.com");

    await user.clear(pixInput);
    await user.type(pixInput, "(79) 99988-7766");

    await user.click(screen.getByRole("button", { name: "Salvar Meus Dados" }));

    expect(mockUpdateMember).toHaveBeenCalledWith({
      memberId: "mem-1",
      updates: expect.objectContaining({
        pix_key: "+5579999887766",
        pix_key_type: "phone",
      }),
    });
  });
});
