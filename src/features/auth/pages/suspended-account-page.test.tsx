import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SuspendedAccountPage } from "./suspended-account-page";

const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("@/state", () => ({
  useUserAccess: () => ({
    profile: { email: "bloqueado@teste.com", suspended_reason: "Violação de regras da comunidade" },
    isBanned: false,
  }),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}));

describe("SuspendedAccountPage Component", () => {
  it("renderiza mensagem de suspensão e justificativa informada", () => {
    render(<SuspendedAccountPage />);

    expect(screen.getByText("Acesso Suspenso")).toBeInTheDocument();
    expect(screen.getByText("Violação de regras da comunidade")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Desconectar/i })).toBeInTheDocument();
  });

  it("chama signOut ao clicar em Desconectar", async () => {
    const user = userEvent.setup();
    render(<SuspendedAccountPage />);

    await user.click(screen.getByRole("button", { name: /Desconectar/i }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
