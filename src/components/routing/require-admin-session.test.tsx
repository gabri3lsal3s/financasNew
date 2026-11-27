import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireAdminSession } from "./require-admin-session";
import { RequireSuperAdmin } from "./require-super-admin";

const mockUseAuth = vi.fn();
const mockUseUserAccess = vi.fn();
const mockCheckAdminPortalGrant = vi.fn();
const mockUseIdleSessionTimeout = vi.fn((...args: unknown[]) => {
  void args;
  return {
    isMonitoringActive: true,
    isWarningVisible: false,
    secondsRemaining: 60,
    stayConnected: vi.fn(),
    signOutNow: vi.fn(),
    resetTimer: vi.fn(),
  };
});

vi.mock("@/state/queries/use-admin-portal-grant", () => ({
  verifyAdminPortalGrant: () => mockCheckAdminPortalGrant(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/use-idle-session-timeout", () => ({
  useIdleSessionTimeout: (opts?: unknown) => mockUseIdleSessionTimeout(opts),
}));

vi.mock("@/components/modules/idle-session-warning-modal", () => ({
  IdleSessionWarningModal: ({
    open,
    secondsRemaining,
  }: {
    open: boolean;
    secondsRemaining: number;
  }) => (open ? <div data-testid="admin-idle-modal">Aviso Admin {secondsRemaining}s</div> : null),
}));

vi.mock("@/components/modules", () => ({
  IdleSessionWarningModal: ({
    open,
    secondsRemaining,
  }: {
    open: boolean;
    secondsRemaining: number;
  }) => (open ? <div data-testid="admin-idle-modal">Aviso Admin {secondsRemaining}s</div> : null),
}));

vi.mock("@/state/queries/use-user-access", () => ({
  useUserAccess: () => mockUseUserAccess(),
}));

describe("RequireAdminSession Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAdminPortalGrant.mockResolvedValue({
      granted: true,
      portalScope: "admin_portal",
      expiresAt: null,
      reason: null,
    });
  });

  it("exibe LoadingScreen enquanto estiver carregando a autenticação ou permissão", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-1" } },
      loading: true,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: true,
      isAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/dashboard" element={<div>Dashboard Admin</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Tela de Login Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Verificando credenciais de operador/i)).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Admin")).not.toBeInTheDocument();
  });

  it("monta useIdleSessionTimeout com forcedPolicy '30m' e exibe aviso prévio de 60s para admin ativo", async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-admin" } },
      loading: false,
      mfaRequired: false,
      mfaVerified: true,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
    });
    mockUseIdleSessionTimeout.mockReturnValue({
      isMonitoringActive: true,
      isWarningVisible: true,
      secondsRemaining: 42,
      stayConnected: vi.fn(),
      signOutNow: vi.fn(),
      resetTimer: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/dashboard" element={<div>Dashboard Admin</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockUseIdleSessionTimeout).toHaveBeenCalledWith(
        expect.objectContaining({
          forcedPolicy: "30m",
          warningSeconds: 60,
          enabled: true,
        }),
      );
    });
    expect(await screen.findByTestId("admin-idle-modal")).toHaveTextContent("Aviso Admin 42s");
  });

  it("redireciona para /admin/login se não houver usuário autenticado", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      loading: false,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/dashboard" element={<div>Dashboard Admin</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Tela de Login Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Dashboard Admin")).not.toBeInTheDocument();
    expect(screen.getByText("Tela de Login Admin")).toBeInTheDocument();
  });

  it("redireciona para /admin/login se o usuário estiver autenticado mas não for admin", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-regular" } },
      loading: false,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/dashboard" element={<div>Dashboard Admin</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Tela de Login Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Dashboard Admin")).not.toBeInTheDocument();
    expect(screen.getByText("Tela de Login Admin")).toBeInTheDocument();
  });

  it("permite acesso ao Outlet se o usuário estiver autenticado, for admin e tiver concessão do portal", async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-admin" } },
      loading: false,
      mfaRequired: false,
      mfaVerified: true,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/dashboard" element={<div>Dashboard Admin Protegido</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Tela de Login Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dashboard Admin Protegido")).toBeInTheDocument();
  });

  it("redireciona para /admin/login se a concessão do portal administrativo for negada ou ausente", async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-admin" } },
      loading: false,
      mfaRequired: false,
      mfaVerified: true,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
    });
    mockCheckAdminPortalGrant.mockResolvedValue({
      granted: false,
      portalScope: null,
      expiresAt: null,
      reason: "portal_grant_missing",
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/dashboard" element={<div>Dashboard Admin Protegido</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Tela de Login Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tela de Login Admin")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Admin Protegido")).not.toBeInTheDocument();
  });

  it("redireciona para /entrar?desafio=totp se a RPC retornar admin_aal2_required", async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-admin" } },
      loading: false,
      mfaRequired: false,
      mfaVerified: false,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
    });
    mockCheckAdminPortalGrant.mockResolvedValue({
      granted: false,
      portalScope: null,
      expiresAt: null,
      reason: "admin_aal2_required",
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/dashboard" element={<div>Dashboard Admin Protegido</div>} />
          </Route>
          <Route path="/entrar" element={<div>Tela de Desafio TOTP</div>} />
          <Route path="/admin/login" element={<div>Tela de Login Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tela de Desafio TOTP")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Admin Protegido")).not.toBeInTheDocument();
  });

  it("encerra loading e redireciona para /admin/login se verifyAdminPortalGrant exceder o timeout", async () => {
    vi.useFakeTimers();
    try {
      mockUseAuth.mockReturnValue({
        session: { user: { id: "u-admin" } },
        loading: false,
        mfaRequired: false,
        mfaVerified: true,
      });
      mockUseUserAccess.mockReturnValue({
        isLoading: false,
        isAdmin: true,
      });
      mockCheckAdminPortalGrant.mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter initialEntries={["/admin/dashboard"]}>
          <Routes>
            <Route element={<RequireAdminSession />}>
              <Route path="/admin/dashboard" element={<div>Dashboard Admin Protegido</div>} />
            </Route>
            <Route path="/admin/login" element={<div>Tela de Login Admin</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText(/Verificando credenciais de operador/i)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
        await Promise.resolve();
      });

      expect(screen.getByText("Tela de Login Admin")).toBeInTheDocument();
      expect(screen.queryByText("Dashboard Admin Protegido")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("redireciona para /entrar?desafio=totp se o admin possui MFA pendente de validação (AAL2)", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-admin" } },
      loading: false,
      mfaRequired: true,
      mfaVerified: false,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/dashboard" element={<div>Dashboard Admin Protegido</div>} />
          </Route>
          <Route path="/entrar" element={<div>Tela de Desafio TOTP</div>} />
          <Route path="/admin/login" element={<div>Tela de Login Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Dashboard Admin Protegido")).not.toBeInTheDocument();
    expect(screen.getByText("Tela de Desafio TOTP")).toBeInTheDocument();
  });
});

describe("RequireSuperAdmin Guard", () => {
  it("exibe LoadingScreen enquanto valida credenciais de superadministrador", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-1" } },
      loading: true,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: true,
      isAdmin: false,
      isSuperAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin/laboratorio-forense"]}>
        <Routes>
          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin/laboratorio-forense" element={<div>Laboratório Forense</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Verificando nível de acesso de superadmin/i)).toBeInTheDocument();
    expect(screen.queryByText("Laboratório Forense")).not.toBeInTheDocument();
  });

  it("redireciona administrador comum (não superadmin) para /admin/dashboard", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-admin" } },
      loading: false,
      mfaRequired: true,
      mfaVerified: true,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
      isSuperAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin/laboratorio-forense"]}>
        <Routes>
          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin/laboratorio-forense" element={<div>Laboratório Forense</div>} />
          </Route>
          <Route path="/admin/dashboard" element={<div>Dashboard Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Laboratório Forense")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard Admin")).toBeInTheDocument();
  });

  it("redireciona para /entrar?desafio=totp quando superadmin ainda não concluiu AAL2", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-super" } },
      loading: false,
      mfaRequired: true,
      mfaVerified: false,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
      isSuperAdmin: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin/laboratorio-forense"]}>
        <Routes>
          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin/laboratorio-forense" element={<div>Laboratório Forense</div>} />
          </Route>
          <Route path="/entrar" element={<div>Tela de Desafio TOTP</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Laboratório Forense")).not.toBeInTheDocument();
    expect(screen.getByText("Tela de Desafio TOTP")).toBeInTheDocument();
  });

  it("libera acesso para superadministrador autenticado com MFA verificado", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-super" } },
      loading: false,
      mfaRequired: true,
      mfaVerified: true,
    });
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
      isSuperAdmin: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin/laboratorio-forense"]}>
        <Routes>
          <Route element={<RequireSuperAdmin />}>
            <Route path="/admin/laboratorio-forense" element={<div>Laboratório Forense</div>} />
          </Route>
          <Route path="/admin/dashboard" element={<div>Dashboard Admin</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Laboratório Forense")).toBeInTheDocument();
  });
});
