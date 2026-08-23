import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { RequireAdmin } from "./require-admin";

const mockUseUserAccess = vi.fn();

vi.mock("@/state", () => ({
  useUserAccess: () => mockUseUserAccess(),
}));

describe("RequireAdmin Guard", () => {
  it("redireciona para a raiz / se o usuário não for administrador", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<div>Painel Admin Secreto</div>} />
          </Route>
          <Route path="/" element={<div>Home Comum</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Painel Admin Secreto")).not.toBeInTheDocument();
    expect(screen.getByText("Home Comum")).toBeInTheDocument();
  });

  it("permite o acesso ao painel administrativo se o usuário for admin ou superadmin", () => {
    mockUseUserAccess.mockReturnValue({
      isLoading: false,
      isAdmin: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<div>Painel Admin Secreto</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Painel Admin Secreto")).toBeInTheDocument();
  });
});
