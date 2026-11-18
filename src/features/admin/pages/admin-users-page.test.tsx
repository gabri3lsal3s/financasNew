import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminUsersPage } from "./admin-users-page";

const mockUseAdminUsers = vi.fn();

vi.mock("@/state", () => ({
  useUserAccess: () => ({ role: "admin" }),
  useAdminUsers: (...args: unknown[]) => mockUseAdminUsers(...args),
}));

vi.mock("../components", () => ({
  UserCreateDialog: () => null,
  UserEditDialog: () => null,
}));

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminUsers.mockReturnValue({ data: [], isLoading: false });
  });

  it("lê o filtro ?status=pending_approval da URL e repassa para useAdminUsers", () => {
    render(
      <MemoryRouter initialEntries={["/admin/usuarios?status=pending_approval"]}>
        <Routes>
          <Route path="/admin/usuarios" element={<AdminUsersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mockUseAdminUsers).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_approval" }),
    );
    expect(screen.getByText("Gestão de Usuários")).toBeInTheDocument();
  });
});
