import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { RequireAdminSession } from "./require-admin-session";

const mockUseAuth = vi.fn();
const mockUseUserAccess = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/state", () => ({
  useUserAccess: () => mockUseUserAccess(),
}));

describe("RequireAdminSession Guard", () => {
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

  it("permite acesso ao Outlet se o usuário estiver autenticado e for admin", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "u-admin" } },
      loading: false,
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

    expect(screen.getByText("Dashboard Admin Protegido")).toBeInTheDocument();
  });
});
