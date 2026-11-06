import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyTab } from "./family-tab";
import * as familyHooks from "@/state/queries/use-family";
import * as toastService from "@/services/toast";
import type { MyFamilyData } from "@/data/repositories/families";

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/state/queries/use-family-mode", () => ({
  useFamilyMode: () => ({
    isFamilyModeEnabled: true,
    toggleFamilyMode: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/state/queries/use-public-shares", () => ({
  useMyPublicShares: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock("@/state/mutations/use-public-share-mutations", () => ({
  useCreatePublicShare: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRevokePublicShare: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRegeneratePublicShare: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const mockFamilyDataWithTwoMembers: MyFamilyData = {
  family: {
    id: "fam-100",
    name: "Família Silva",
    owner_id: "user-1",
    monthly_budget: 600000,
    split_rule: "equal",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  },
  members: [
    {
      id: "mem-1",
      family_id: "fam-100",
      user_id: "user-1",
      role: "owner",
      display_name: "Gabriel",
      pix_key: "gabriel@pix.me",
      pix_key_type: "email",
      split_ratio: 0.5,
      profile_name: "Gabriel Silva",
      profile_email: "gabriel@email.com",
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "mem-2",
      family_id: "fam-100",
      user_id: "user-2",
      role: "member",
      display_name: "Mariana",
      pix_key: "11999999999",
      pix_key_type: "phone",
      split_ratio: 0.5,
      profile_name: "Mariana Silva",
      profile_email: "mariana@email.com",
      created_at: "2026-11-02T00:00:00Z",
      updated_at: "2026-11-02T00:00:00Z",
    },
  ],
  currentMember: {
    id: "mem-1",
    family_id: "fam-100",
    user_id: "user-1",
    role: "owner",
    display_name: "Gabriel",
    pix_key: "gabriel@pix.me",
    pix_key_type: "email",
    split_ratio: 0.5,
    profile_name: "Gabriel Silva",
    profile_email: "gabriel@email.com",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  },
  invites: [
    {
      id: "inv-1",
      family_id: "fam-100",
      invited_by: "user-1",
      invited_email: "outro@email.com",
      token: "tokenseguro123",
      status: "pending",
      role: "member",
      created_at: "2026-11-05T00:00:00Z",
      expires_at: new Date(Date.now() + 864000000).toISOString(),
    },
  ],
};

const mockFamilyDataSingleMember: MyFamilyData = {
  family: {
    id: "fam-101",
    name: "Lar & Conforto",
    owner_id: "user-1",
    monthly_budget: null,
    split_rule: "proportional",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  },
  members: [
    {
      id: "mem-1",
      family_id: "fam-101",
      user_id: "user-1",
      role: "owner",
      display_name: "Gabriel",
      pix_key: null,
      pix_key_type: null,
      split_ratio: 0.6,
      profile_name: "Gabriel Silva",
      profile_email: "gabriel@email.com",
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
  ],
  currentMember: {
    id: "mem-1",
    family_id: "fam-101",
    user_id: "user-1",
    role: "owner",
    display_name: "Gabriel",
    pix_key: null,
    pix_key_type: null,
    split_ratio: 0.6,
    profile_name: "Gabriel Silva",
    profile_email: "gabriel@email.com",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  },
  invites: [],
};

function renderFamilyTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FamilyTab />
    </QueryClientProvider>,
  );
}

describe("FamilyTab", () => {
  const mockCreateFamily = vi.fn().mockResolvedValue("new-family-id");
  const mockInviteMember = vi.fn().mockResolvedValue({
    id: "inv-new",
    family_id: "fam-100",
    token: "tokengerado999",
    role: "member",
    status: "pending",
    expires_at: new Date(Date.now() + 864000000).toISOString(),
    invite_url: "http://localhost:3000/convite-familiar/tokengerado999",
  });
  const mockRevokeInvite = vi.fn().mockResolvedValue(undefined);
  const mockLeaveFamily = vi.fn().mockResolvedValue({ success: true, disbanded: false });
  const mockDeleteFamily = vi.fn().mockResolvedValue(true);
  const mockRemoveMember = vi.fn().mockResolvedValue({
    success: true,
    family_id: "fam-100",
    removed_user_id: "user-2",
  });
  const mockUpdateFamily = vi.fn().mockResolvedValue({
    id: "fam-100",
    name: "Família Silva Santos",
    monthly_budget: 700000,
    split_rule: "equal",
  });
  const mockUpdateMember = vi.fn().mockResolvedValue({
    id: "mem-1",
    display_name: "Gabriel S.",
    pix_key: "novo@pix.com",
    pix_key_type: "email",
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(familyHooks, "useCreateFamily").mockReturnValue({
      mutateAsync: mockCreateFamily,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useCreateFamily>);

    vi.spyOn(familyHooks, "useInviteFamilyMember").mockReturnValue({
      mutateAsync: mockInviteMember,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useInviteFamilyMember>);

    vi.spyOn(familyHooks, "useRevokeFamilyInvite").mockReturnValue({
      mutateAsync: mockRevokeInvite,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useRevokeFamilyInvite>);

    vi.spyOn(familyHooks, "useLeaveFamily").mockReturnValue({
      mutateAsync: mockLeaveFamily,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useLeaveFamily>);

    vi.spyOn(familyHooks, "useDeleteFamily").mockReturnValue({
      mutateAsync: mockDeleteFamily,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useDeleteFamily>);

    vi.spyOn(familyHooks, "useRemoveFamilyMember").mockReturnValue({
      mutateAsync: mockRemoveMember,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useRemoveFamilyMember>);

    vi.spyOn(familyHooks, "useUpdateFamily").mockReturnValue({
      mutateAsync: mockUpdateFamily,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useUpdateFamily>);

    vi.spyOn(familyHooks, "useUpdateFamilyMember").mockReturnValue({
      mutateAsync: mockUpdateMember,
      isPending: false,
    } as unknown as ReturnType<typeof familyHooks.useUpdateFamilyMember>);
  });

  it("renderiza skeleton durante o carregamento dos dados", () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();
    expect(screen.getByTestId("family-tab-loading")).toBeInTheDocument();
  });

  it("renderiza estado de erro com botão de tentar novamente", async () => {
    const mockRefetch = vi.fn();
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Falha na conexão"),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();
    expect(screen.getByText("Falha na conexão")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /Tentar novamente/i });
    expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renderiza estado sem família ativa e permite abrir modal e criar família", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();
    expect(screen.getByTestId("family-tab-empty")).toBeInTheDocument();
    expect(screen.getByText("Sem Família Ativa")).toBeInTheDocument();

    const createBtn = screen.getByRole("button", { name: /Criar Família/i });
    expect(createBtn).toBeInTheDocument();

    await userEvent.click(createBtn);

    // Modal aberto
    expect(screen.getByRole("heading", { name: "Criar Orçamento Familiar" })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Nome da Família \/ Casa/i);
    await userEvent.type(nameInput, "Casa Nova");

    const submitBtn = screen.getByRole("button", { name: /^Criar Família$/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateFamily).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Casa Nova",
          splitRule: "combined",
        }),
      );
    });
  });

  it("renderiza dados da família ativa, teto e membros cadastrados", () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: mockFamilyDataWithTwoMembers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    expect(screen.getByTestId("family-tab-content")).toBeInTheDocument();
    expect(screen.getByText("Família Silva")).toBeInTheDocument();
    expect(screen.getAllByText("Titular").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Divisão 50/50")).toBeInTheDocument();

    // Membros
    expect(screen.getByText("Gabriel")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByText("Você")).toBeInTheDocument();
    expect(screen.getByText("gabriel@pix.me")).toBeInTheDocument();
  });

  it("permite ao titular abrir modal de edição dos parâmetros da família", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: mockFamilyDataWithTwoMembers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    const editBtn = screen.getByRole("button", { name: /Editar Parâmetros/i });
    await userEvent.click(editBtn);

    expect(
      screen.getByRole("heading", { name: "Editar Parâmetros da Família" }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Nome da Família \/ Casa/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Família Silva Santos");

    const saveBtn = screen.getByRole("button", { name: /Salvar Alterações/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateFamily).toHaveBeenCalledWith(
        expect.objectContaining({
          familyId: "fam-100",
          updates: expect.objectContaining({
            name: "Família Silva Santos",
          }),
        }),
      );
    });
  });

  it("permite ao usuário autenticado editar seus dados Pix na família", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: mockFamilyDataWithTwoMembers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    const editPixBtn = screen.getByRole("button", { name: /Editar Meus Dados Pix/i });
    await userEvent.click(editPixBtn);

    expect(screen.getByRole("heading", { name: "Meus Dados na Família" })).toBeInTheDocument();

    const pixInput = screen.getByLabelText(/^Chave Pix/i);
    await userEvent.clear(pixInput);
    await userEvent.type(pixInput, "novo@pix.com");

    const saveBtn = screen.getByRole("button", { name: /Salvar Dados/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateMember).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: "mem-1",
          updates: expect.objectContaining({
            pix_key: "novo@pix.com",
          }),
        }),
      );
    });
  });

  it("copia a chave Pix do membro para o clipboard ao clicar", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: mockFamilyDataWithTwoMembers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    renderFamilyTab();

    const copyPixBtn = screen.getAllByTitle("Copiar Chave Pix")[0];
    expect(copyPixBtn).toBeDefined();
    await userEvent.click(copyPixBtn!);

    expect(writeTextSpy).toHaveBeenCalledWith("gabriel@pix.me");
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Chave Pix copiada!",
      }),
    );
  });

  it("exibe convites pendentes e permite revogar o convite", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: mockFamilyDataWithTwoMembers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    expect(screen.getByText("Convites Pendentes de Aceite")).toBeInTheDocument();
    expect(screen.getByText("Aguardando Parceiro")).toBeInTheDocument();

    const revokeBtn = screen.getByRole("button", { name: /Revogar/i });
    await userEvent.click(revokeBtn);

    expect(screen.getByRole("heading", { name: "Revogar Convite" })).toBeInTheDocument();

    const confirmRevokeBtn = screen.getByRole("button", { name: /Confirmar Revogação/i });
    await userEvent.click(confirmRevokeBtn);

    await waitFor(() => {
      expect(mockRevokeInvite).toHaveBeenCalledWith("inv-1");
    });
  });

  it("permite gerar convite para parceiro e exibe URL para cópia", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: mockFamilyDataSingleMember,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    expect(screen.getByText("Nenhum parceiro vinculado ainda")).toBeInTheDocument();

    const inviteBtn = screen.getByRole("button", { name: /Gerar Convite de Acesso/i });
    await userEvent.click(inviteBtn);

    expect(screen.getByRole("heading", { name: "Convidar Parceiro(a)" })).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/E-mail do parceiro/i);
    await userEvent.type(emailInput, "mariana@email.com");

    const submitInviteBtn = screen.getByRole("button", { name: /Gerar Link de Convite/i });
    await userEvent.click(submitInviteBtn);

    await waitFor(() => {
      expect(mockInviteMember).toHaveBeenCalledWith(
        expect.objectContaining({
          invitedEmail: "mariana@email.com",
          role: "member",
        }),
      );
    });

    expect(screen.getByText("Link de convite gerado com sucesso!")).toBeInTheDocument();
  });

  it("abre modal de confirmação e executa a saída da família", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: {
        ...mockFamilyDataWithTwoMembers,
        currentMember: {
          ...mockFamilyDataWithTwoMembers.currentMember,
          role: "member",
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    const leaveBtn = screen.getByRole("button", { name: /^Sair da Família$/i });
    await userEvent.click(leaveBtn);

    expect(screen.getByRole("heading", { name: "Sair da Família" })).toBeInTheDocument();

    const confirmLeaveBtn = screen.getByRole("button", { name: /Confirmar Saída/i });
    await userEvent.click(confirmLeaveBtn);

    await waitFor(() => {
      expect(mockLeaveFamily).toHaveBeenCalled();
    });
  });

  it("abre modal de confirmação e executa a exclusão da família pelo titular", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: mockFamilyDataWithTwoMembers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    const deleteBtn = screen.getByRole("button", { name: /^Excluir Família$/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText(/Tem certeza de que deseja excluir a família/i)).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: /Confirmar Exclusão/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockDeleteFamily).toHaveBeenCalled();
    });
  });

  it("exibe botão de remover membro para o titular e executa remoção via modal", async () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: mockFamilyDataWithTwoMembers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    // Mariana Silva é user-2, Gabriel é o titular (user-1)
    const removeBtn = screen.getByRole("button", { name: /Remover Mariana/i });
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);

    expect(await screen.findByRole("heading", { name: "Remover Membro da Família" })).toBeInTheDocument();
    expect(screen.getByText(/Tem certeza de que deseja remover Mariana/i)).toBeInTheDocument();

    const confirmRemoveBtn = screen.getByRole("button", { name: /Confirmar Remoção/i });
    fireEvent.click(confirmRemoveBtn);

    await waitFor(() => {
      expect(mockRemoveMember).toHaveBeenCalledWith({
        familyId: "fam-100",
        targetUserId: "user-2",
      });
    });
  });

  it("NÃO exibe botão de remover membro para participantes que não são titulares", () => {
    vi.spyOn(familyHooks, "useMyFamily").mockReturnValue({
      data: {
        ...mockFamilyDataWithTwoMembers,
        currentMember: {
          ...mockFamilyDataWithTwoMembers.currentMember,
          role: "member",
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof familyHooks.useMyFamily>);

    renderFamilyTab();

    expect(screen.queryByRole("button", { name: /Remover/i })).not.toBeInTheDocument();
  });
});
