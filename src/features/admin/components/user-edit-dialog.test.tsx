import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserEditDialog } from "./user-edit-dialog";
import type { AdminUserRow } from "@/types";

const mockSetSubscriptionMutateAsync = vi.fn();
const mockSetModulePermissionMutateAsync = vi.fn();
const mockRemoveModulePermissionMutateAsync = vi.fn();

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
  useAdminFeatures: () => ({ data: [], isLoading: false }),
  useUserOverrides: () => ({ data: [], isLoading: false }),
  useAdminUpdateUserStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminSetUserRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminSetFeatureOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminRemoveFeatureOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
    data: [
      {
        id: "perm-1",
        user_id: "u-123",
        module_key: "investments",
        access_level: "read",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ],
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
});
