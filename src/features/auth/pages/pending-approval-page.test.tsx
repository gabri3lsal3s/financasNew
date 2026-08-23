import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PendingApprovalPage } from "./pending-approval-page";

const mockRefetch = vi.fn().mockResolvedValue(undefined);
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("@/state", () => ({
  useUserAccess: () => ({
    profile: { email: "usuario@teste.com" },
    refetch: mockRefetch,
    isActive: false,
  }),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}));

describe("PendingApprovalPage Component", () => {
  it("renderiza mensagem institucional de cadastro em análise e e-mail do usuário", () => {
    render(<PendingApprovalPage />);

    expect(screen.getByText("Cadastro em Análise")).toBeInTheDocument();
    expect(screen.getByText(/aguardando liberação de acesso/i)).toBeInTheDocument();
    expect(screen.getByText("usuario@teste.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verificar Aprovação/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair da Conta/i })).toBeInTheDocument();
  });

  it("chama refetch ao clicar em Verificar Aprovação", async () => {
    const user = userEvent.setup();
    render(<PendingApprovalPage />);

    await user.click(screen.getByRole("button", { name: /Verificar Aprovação/i }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("chama signOut ao clicar em Sair da Conta", async () => {
    const user = userEvent.setup();
    render(<PendingApprovalPage />);

    await user.click(screen.getByRole("button", { name: /Sair da Conta/i }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
