import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AdminPage } from "./admin-page";

vi.mock("@/state", () => ({
  useUserAccess: () => ({
    role: "superadmin",
    isAdmin: true,
    isSuperAdmin: true,
  }),
  useAdminMetrics: () => ({
    data: {
      total_users: 120,
      active_users: 110,
      pending_users: 5,
      suspended_users: 5,
      total_invites: 50,
      used_invites: 30,
    },
    isLoading: false,
  }),
  useAdminUsers: () => ({
    data: [
      {
        id: "u-1",
        name: "Carlos Silva",
        email: "carlos@teste.com",
        role: "user",
        status: "pending_approval",
        created_at: "2026-08-20T10:00:00Z",
        total_count: 1,
      },
    ],
    isLoading: false,
  }),
  useAdminFeatures: () => ({
    data: [
      {
        key: "investments",
        name: "Módulo de Investimentos",
        description: "Gestão patrimonial",
        is_globally_enabled: true,
        default_enabled_for_new_users: true,
      },
    ],
    isLoading: false,
  }),
  useAdminInvites: () => ({
    data: [
      {
        id: "inv-1",
        code: "GF-VIP-2026",
        max_uses: 10,
        used_count: 3,
        is_revoked: false,
        created_at: "2026-08-01T00:00:00Z",
      },
    ],
    isLoading: false,
  }),
  useAdminAuditLogs: () => ({
    data: [
      {
        id: "log-1",
        entity_type: "profiles",
        entity_id: "u-1",
        action: "UPDATE_STATUS",
        user_id: "admin-1",
        created_at: "2026-08-23T12:00:00Z",
        payload: { status: "active" },
      },
    ],
    isLoading: false,
  }),

  useAdminUpdateUserStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminSetUserRole: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminSetFeatureOverride: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminRemoveFeatureOverride: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminToggleGlobalFeature: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminCreateInvite: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminCreateModularInvite: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminRevokeInvite: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminPlans: () => ({ data: [], isLoading: false }),
  useAdminUserSubscription: () => ({ data: null, isLoading: false }),
  useAdminUserModulePermissions: () => ({ data: [], isLoading: false }),
  useAdminSetUserSubscription: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminSetUserModulePermission: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdminRemoveUserModulePermission: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserOverrides: () => ({ data: [], isLoading: false }),
}));

describe("AdminPage Component", () => {
  it("renderiza o cabeçalho e os KPIs da aba Visão Geral por padrão", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Painel Administrativo" })).toBeInTheDocument();
    expect(screen.getByText("Total de Usuários")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Status Operacional da Plataforma")).toBeInTheDocument();
    expect(screen.getByText("Fila de Aprovação Imediata")).toBeInTheDocument();
    expect(screen.getAllByText("Carlos Silva")[0]).toBeInTheDocument();
  });

  it("permite alternar para a aba de Gestão de Usuários", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /Gestão de Usuários/i }));
    expect(screen.getByPlaceholderText(/Buscar por nome ou e-mail/i)).toBeInTheDocument();
    expect(screen.getAllByText("carlos@teste.com")[0]).toBeInTheDocument();
  });

  it("permite alternar para a aba de Convites & Allowlist", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /Convites & Allowlist/i }));
    expect(screen.getAllByText("GF-VIP-2026")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar Novo Convite/i })).toBeInTheDocument();
  });

  it("permite alternar para a aba de Sistema & Auditoria e exibe flags e logs", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /Sistema & Auditoria/i }));
    expect(screen.getByText("Funcionalidades & Kill-Switches Globais")).toBeInTheDocument();
    expect(screen.getByText("Módulo de Investimentos")).toBeInTheDocument();
    expect(screen.getByText("Trilha de Auditoria & Segurança")).toBeInTheDocument();
    expect(screen.getAllByText("UPDATE_STATUS")[0]).toBeInTheDocument();
  });

  it("resolve deep-links legados (?aba=funcionalidades ou ?tab=auditoria) para a aba Sistema", () => {
    render(
      <MemoryRouter initialEntries={["/admin?aba=funcionalidades"]}>
        <AdminPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Funcionalidades & Kill-Switches Globais")).toBeInTheDocument();
  });
});
