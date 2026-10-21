import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireActiveAccount } from "./require-active-account";

const mockUseUserAccess = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/state", () => ({
  useUserAccess: () => mockUseUserAccess(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("RequireActiveAccount Guard", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-123" } },
      user: { id: "user-123" },
      loading: false,
      configError: null,
    });
  });
  it("redireciona para /aprovacao-pendente se a conta estiver aguardando aprovação", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isPendingApproval: true,
      isSuspended: false,
      isBanned: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<RequireActiveAccount />}>
            <Route path="/dashboard" element={<div>Dashboard Protegido</div>} />
          </Route>
          <Route path="/aprovacao-pendente" element={<div>Tela de Aprovação Pendente</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Dashboard Protegido")).not.toBeInTheDocument();
    expect(screen.getByText("Tela de Aprovação Pendente")).toBeInTheDocument();
  });

  it("redireciona para /conta-suspensa se a conta estiver suspensa ou banida", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isPendingApproval: false,
      isSuspended: true,
      isBanned: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<RequireActiveAccount />}>
            <Route path="/dashboard" element={<div>Dashboard Protegido</div>} />
          </Route>
          <Route path="/conta-suspensa" element={<div>Tela de Bloqueio</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Dashboard Protegido")).not.toBeInTheDocument();
    expect(screen.getByText("Tela de Bloqueio")).toBeInTheDocument();
  });

  it("permite o acesso ao conteúdo protegido se a conta estiver ativa", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isPendingApproval: false,
      isSuspended: false,
      isBanned: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<RequireActiveAccount />}>
            <Route path="/dashboard" element={<div>Dashboard Protegido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard Protegido")).toBeInTheDocument();
  });
});
