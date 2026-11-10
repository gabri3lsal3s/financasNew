import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserEditDialog } from "./user-edit-dialog";
import type { AdminUserRow, UserModulePermission } from "@/types";

const mockSetSubscriptionMutateAsync = vi.fn();
const mockSetModulePermissionMutateAsync = vi.fn();
const mockRemoveModulePermissionMutateAsync = vi.fn();
const mockDeleteUserMutateAsync = vi.fn();
const mockResetMfaMutateAsync = vi.fn();
const mockRevokeSessionsMutateAsync = vi.fn();
const mockGenerateRecoveryMutateAsync = vi.fn();

let mockCurrentUserRole = "superadmin";
let mockAuthUserId = "superadmin-999";

let mockModulePermissions: UserModulePermission[] = [
  {
    id: "perm-1",
    user_id: "u-123",
    module_key: "investments",
    access_level: "read",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  },
];

const mockUser: AdminUserRow = {
  id: "u-123",
  name: "Maria Santos",
  email: "maria@teste.com",
  role: "user",
  status: "active",
  created_at: "2026-08-01T00:00:00Z",
  approved_at: null,
  approved_by: null,
  suspended_reason: null,
  total_count: 1,
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: mockAuthUserId, email: "super@admin.com" },
  }),
}));

vi.mock("@/state", () => ({
  useUserAccess: () => ({
    role: mockCurrentUserRole,
    isAdmin: mockCurrentUserRole === "admin" || mockCurrentUserRole === "superadmin",
    isSuperAdmin: mockCurrentUserRole === "superadmin",
    profile: { id: mockAuthUserId, name: "Super Admin", role: mockCurrentUserRole },
  }),
  useAdminUpdateUserStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminSetUserRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminDeleteUser: () => ({
    mutateAsync: mockDeleteUserMutateAsync,
    isPending: false,
  }),
  useAdminResetMFA: () => ({
    mutateAsync: mockResetMfaMutateAsync,
    isPending: false,
  }),
  useAdminRevokeSessions: () => ({
    mutateAsync: mockRevokeSessionsMutateAsync,
    isPending: false,
  }),
  useAdminGenerateRecoveryLink: () => ({
    mutateAsync: mockGenerateRecoveryMutateAsync,
    isPending: false,
  }),
  useAdminUserContact: () => ({
    data: { email: "maria@teste.com", phone: "11999998888" },
    isLoading: false,
  }),
  useAdminPlans: () => ({ data: [], isLoading: false }),
  useAdminUserSubscription: () => ({
    data: {
      id: "sub-1",
      user_id: "u-123",
      plan_id: "free",
      tier: "trial",
      status: "active",
      starts_at: "2026-08-01T00:00:00Z",
      trial_ends_at: "2026-08-31T00:00:00Z",
      current_period_end: null,
      cancel_at_period_end: false,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
    isLoading: false,
  }),
  useAdminUserModulePermissions: () => ({
    data: mockModulePermissions,
    isLoading: false,
  }),
  useAdminSetUserSubscription: () => ({
    mutateAsync: mockSetSubscriptionMutateAsync,
    isPending: false,
  }),
  useAdminSetUserModulePermission: () => ({
    mutateAsync: mockSetModulePermissionMutateAsync,
    isPending: false,
  }),
  useAdminRemoveUserModulePermission: () => ({
    mutateAsync: mockRemoveModulePermissionMutateAsync,
    isPending: false,
  }),
}));

describe("UserEditDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserRole = "superadmin";
    mockAuthUserId = "superadmin-999";
    mockModulePermissions = [
      {
        id: "perm-1",
        user_id: "u-123",
        module_key: "investments",
        access_level: "read",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ];
    mockSetSubscriptionMutateAsync.mockResolvedValue(undefined);
    mockSetModulePermissionMutateAsync.mockResolvedValue(undefined);
    mockRemoveModulePermissionMutateAsync.mockResolvedValue(undefined);
    mockDeleteUserMutateAsync.mockResolvedValue(undefined);
  });

  it("renderiza os detalhes do usuário, seção de assinatura e permissões modulares", () => {
    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /Gerar|Gerenciar Usuário/i })).toBeInTheDocument();
    expect(screen.getByText("maria@teste.com")).toBeInTheDocument();
    expect(screen.getByText(/Plano SaaS & Assinatura/i)).toBeInTheDocument();
    expect(screen.getByText(/Permissões Modulares Granulares/i)).toBeInTheDocument();
  });

  it("permite alterar e salvar o plano/tier de assinatura", async () => {
    const user = userEvent.setup();
    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    const saveSubBtn = screen.getByRole("button", { name: /Atualizar Plano \/ Tier/i });
    expect(saveSubBtn).toBeInTheDocument();
    await user.click(saveSubBtn);

    expect(mockSetSubscriptionMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-123",
        tier: "trial",
        status: "active",
      }),
    );
  });

  it("permite definir override de permissão para um módulo", async () => {
    const user = userEvent.setup();
    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    const totalBtns = screen.getAllByRole("button", { name: /Total/i });
    expect(totalBtns.length).toBeGreaterThan(0);
    await user.click(totalBtns[0]!);

    expect(mockSetModulePermissionMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-123",
        accessLevel: "write",
      }),
    );
  });

  it("renderiza seções de Funcionalidades Beta e Módulos do Plano Base com overrides e derivação responsiva", () => {
    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    // Seções dedicadas
    expect(screen.getByText(/Funcionalidades Beta \(Acesso Selecionado\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Módulos do Plano Base/i).length).toBeGreaterThan(0);

    // Módulos do core com override devem exibir o badge correspondente
    expect(screen.getByText(/Override: Somente Leitura/i)).toBeInTheDocument();

    // Módulos do core sem override exibem derivação responsiva do plano ativo (8 módulos core)
    const activePlanBadges = screen.getAllByText("Acesso Total (Plano Ativo)");
    expect(activePlanBadges.length).toBe(8);

    // Funcionalidade beta sem concessão opera bloqueada por padrão
    expect(screen.getByText("Bloqueado (Padrão Beta)")).toBeInTheDocument();

    // Botões de ação rápida presentes
    expect(screen.getByRole("button", { name: /Apenas Investimentos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restaurar Padrão do Plano/i })).toBeInTheDocument();
  });

  it("renderiza badges responsivos do plano e omite botão restaurar quando não há overrides", () => {
    mockModulePermissions = [];
    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    // Todos os 9 módulos core exibem Acesso Total (Plano Ativo)
    const activePlanBadges = screen.getAllByText("Acesso Total (Plano Ativo)");
    expect(activePlanBadges.length).toBe(9);

    // Funcionalidade beta permanece com Bloqueado (Padrão Beta)
    expect(screen.getByText("Bloqueado (Padrão Beta)")).toBeInTheDocument();

    // Botão de restaurar não deve aparecer quando não há overrides
    expect(screen.queryByRole("button", { name: /Restaurar Padrão do Plano/i })).not.toBeInTheDocument();

    // Botão de atalho para Apenas Investimentos continua disponível
    expect(screen.getByRole("button", { name: /Apenas Investimentos/i })).toBeInTheDocument();
  });

  it("executa a ação rápida 'Apenas Investimentos', liberando investimentos e relatórios e bloqueando módulos de despesas", async () => {
    const user = userEvent.setup();
    mockModulePermissions = [];

    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    const quickInvestBtn = screen.getByRole("button", { name: /Apenas Investimentos/i });
    await user.click(quickInvestBtn);

    // Deve salvar acesso total para o módulo de investimentos
    expect(mockSetModulePermissionMutateAsync).toHaveBeenCalledWith({
      userId: "u-123",
      moduleKey: "investments",
      accessLevel: "write",
    });

    // Deve salvar acesso de relatórios exclusivos de investimentos
    expect(mockSetModulePermissionMutateAsync).toHaveBeenCalledWith({
      userId: "u-123",
      moduleKey: "reports",
      accessLevel: "write",
    });

    // Deve bloquear módulos de despesas diárias
    expect(mockSetModulePermissionMutateAsync).toHaveBeenCalledWith({
      userId: "u-123",
      moduleKey: "transactions",
      accessLevel: "none",
    });
    expect(mockSetModulePermissionMutateAsync).toHaveBeenCalledWith({
      userId: "u-123",
      moduleKey: "cards",
      accessLevel: "none",
    });
  });

  it("executa a ação rápida 'Restaurar Padrão do Plano', removendo todos os overrides ativos", async () => {
    const user = userEvent.setup();
    mockModulePermissions = [
      {
        id: "perm-1",
        user_id: "u-123",
        module_key: "investments",
        access_level: "read",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
      {
        id: "perm-2",
        user_id: "u-123",
        module_key: "debts",
        access_level: "write",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ];

    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    const restoreBtn = screen.getByRole("button", { name: /Restaurar Padrão do Plano/i });
    await user.click(restoreBtn);

    expect(mockRemoveModulePermissionMutateAsync).toHaveBeenCalledWith({
      userId: "u-123",
      moduleKey: "investments",
    });
    expect(mockRemoveModulePermissionMutateAsync).toHaveBeenCalledWith({
      userId: "u-123",
      moduleKey: "debts",
    });
  });

  describe("Exclusão de Usuário do Sistema (Superadmin)", () => {
    it("exibe o botão 'Excluir Usuário do Sistema' quando o usuário é superadmin e não é autoexclusão", () => {
      mockCurrentUserRole = "superadmin";
      mockAuthUserId = "superadmin-999";
      render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("Zona de Perigo: Exclusão Definitiva")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Excluir Usuário do Sistema" }),
      ).toBeInTheDocument();
    });

    it("oculta a Zona de Perigo e botão de exclusão quando o executor é um admin regular", () => {
      mockCurrentUserRole = "admin";
      mockAuthUserId = "admin-888";
      render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

      expect(screen.queryByText("Zona de Perigo: Exclusão Definitiva")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Excluir Usuário do Sistema" }),
      ).not.toBeInTheDocument();
    });

    it("oculta a Zona de Perigo e botão de exclusão quando o usuário editado é o próprio superadmin logado (bloqueio de autoexclusão)", () => {
      mockCurrentUserRole = "superadmin";
      mockAuthUserId = "u-123"; // mesmo ID do mockUser
      render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

      expect(screen.queryByText("Zona de Perigo: Exclusão Definitiva")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Excluir Usuário do Sistema" }),
      ).not.toBeInTheDocument();
    });

    it("abre o ConfirmDialog e executa a exclusão ao confirmar", async () => {
      const user = userEvent.setup();
      mockCurrentUserRole = "superadmin";
      mockAuthUserId = "superadmin-999";
      const onOpenChangeMock = vi.fn();

      render(<UserEditDialog user={mockUser} open={true} onOpenChange={onOpenChangeMock} />);

      const deleteBtn = screen.getByRole("button", { name: "Excluir Usuário do Sistema" });
      await user.click(deleteBtn);

      expect(screen.getByRole("heading", { name: "Excluir Usuário do Sistema" })).toBeInTheDocument();
      expect(
        screen.getByText(/Tem certeza que deseja excluir permanentemente o usuário Maria Santos\?/i),
      ).toBeInTheDocument();

      const confirmBtn = screen.getByRole("button", { name: "Excluir Definitivamente" });
      await user.click(confirmBtn);

      expect(mockDeleteUserMutateAsync).toHaveBeenCalledWith({
        targetUserId: "u-123",
      });
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    });
  });

  describe("Ações de Suporte do Superadmin", () => {
    it("exibe ações de Reset 2FA, Derrubar Sessões e Link Recuperação para superadmin", () => {
      mockCurrentUserRole = "superadmin";
      render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText("Ações de Suporte do Superadmin")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Resetar 2FA/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Derrubar Sessões/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Link Recuperação/i })).toBeInTheDocument();
    });

    it("executa o reset de 2FA após confirmação no ConfirmDialog", async () => {
      const user = userEvent.setup();
      mockCurrentUserRole = "superadmin";
      mockResetMfaMutateAsync.mockResolvedValueOnce(undefined);

      render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

      const resetBtn = screen.getByRole("button", { name: /Resetar 2FA/i });
      await user.click(resetBtn);

      expect(
        screen.getByRole("heading", { name: "Resetar Autenticação em Duas Etapas (2FA)" }),
      ).toBeInTheDocument();

      const confirmBtn = screen.getByRole("button", { name: "Resetar 2FA" });
      await user.click(confirmBtn);

      expect(mockResetMfaMutateAsync).toHaveBeenCalledWith("u-123");
    });

    it("executa a revogação de sessões ativas após confirmação no ConfirmDialog", async () => {
      const user = userEvent.setup();
      mockCurrentUserRole = "superadmin";
      mockRevokeSessionsMutateAsync.mockResolvedValueOnce(undefined);

      render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

      const revokeBtn = screen.getByRole("button", { name: /Derrubar Sessões/i });
      await user.click(revokeBtn);

      expect(
        screen.getByRole("heading", { name: "Encerrar Sessões Ativas (Derrubar Login)" }),
      ).toBeInTheDocument();

      const confirmBtn = screen.getByRole("button", { name: "Encerrar Sessões" });
      await user.click(confirmBtn);

      expect(mockRevokeSessionsMutateAsync).toHaveBeenCalledWith("u-123");
    });

    it("gera o link de recuperação sob demanda e permite copiar", async () => {
      const user = userEvent.setup();
      mockCurrentUserRole = "superadmin";
      mockGenerateRecoveryMutateAsync.mockResolvedValueOnce("https://financas.app/#access_token=xyz");

      render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

      const genBtn = screen.getByRole("button", { name: /Link Recuperação/i });
      await user.click(genBtn);

      expect(mockGenerateRecoveryMutateAsync).toHaveBeenCalledWith({
        userId: "u-123",
        email: "maria@teste.com",
      });

      expect(screen.getByText("Link de Acesso Direto Gerado:")).toBeInTheDocument();
      expect(screen.getByDisplayValue("https://financas.app/#access_token=xyz")).toBeInTheDocument();
    });
  });
});
