import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserEditDialog } from "./user-edit-dialog";
import type { AdminUserRow, UserModulePermission } from "@/types";

const mockSetSubscriptionMutateAsync = vi.fn();
const mockSetModulePermissionMutateAsync = vi.fn();
const mockRemoveModulePermissionMutateAsync = vi.fn();

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

vi.mock("@/state", () => ({
  useUserAccess: () => ({
    role: "superadmin",
    isAdmin: true,
    isSuperAdmin: true,
  }),
  useAdminUpdateUserStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminSetUserRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

  it("renderiza o card de aviso contextual e os badges 'Bloqueado (Whitelist)' quando há overrides ativos", () => {
    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    // Card de aviso do modo Whitelist
    expect(screen.getByText(/Modo Whitelist Ativo \(Licença Restrita\)/i)).toBeInTheDocument();

    // Módulos sem override devem exibir o badge Bloqueado (Whitelist)
    const whitelistBadges = screen.getAllByText("Bloqueado (Whitelist)");
    expect(whitelistBadges.length).toBe(8); // 9 módulos no total, 1 com override ('investments'), 8 bloqueados

    // O módulo com override deve exibir o badge correspondente
    expect(screen.getByText(/Override: Somente Leitura/i)).toBeInTheDocument();

    // Botões de ação rápida presentes
    expect(screen.getByRole("button", { name: /Apenas Investimentos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restaurar Padrão do Plano/i })).toBeInTheDocument();
  });

  it("renderiza badges 'Padrão do Plano' e omite card de aviso e botão restaurar quando não há overrides", () => {
    mockModulePermissions = [];
    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    // Card de aviso NÃO deve ser renderizado
    expect(screen.queryByText(/Modo Whitelist Ativo/i)).not.toBeInTheDocument();

    // Todos os 9 módulos devem exibir Padrão do Plano
    const defaultBadges = screen.getAllByText("Padrão do Plano");
    expect(defaultBadges.length).toBe(9);

    // Não deve haver badges Bloqueado (Whitelist)
    expect(screen.queryByText("Bloqueado (Whitelist)")).not.toBeInTheDocument();

    // Botão de restaurar não deve aparecer quando já está no padrão do plano
    expect(screen.queryByRole("button", { name: /Restaurar Padrão do Plano/i })).not.toBeInTheDocument();

    // Botão de atalho para Apenas Investimentos continua disponível
    expect(screen.getByRole("button", { name: /Apenas Investimentos/i })).toBeInTheDocument();
  });

  it("executa a ação rápida 'Apenas Investimentos', configurando investimentos e limpando outros overrides", async () => {
    const user = userEvent.setup();
    mockModulePermissions = [
      {
        id: "perm-cards",
        user_id: "u-123",
        module_key: "cards",
        access_level: "none",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ];

    render(<UserEditDialog user={mockUser} open={true} onOpenChange={vi.fn()} />);

    const quickInvestBtn = screen.getByRole("button", { name: /Apenas Investimentos/i });
    await user.click(quickInvestBtn);

    // Deve salvar acesso total para o módulo de investimentos
    expect(mockSetModulePermissionMutateAsync).toHaveBeenCalledWith({
      userId: "u-123",
      moduleKey: "investments",
      accessLevel: "write",
    });

    // Deve remover o override anterior do módulo cards
    expect(mockRemoveModulePermissionMutateAsync).toHaveBeenCalledWith({
      userId: "u-123",
      moduleKey: "cards",
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
});
