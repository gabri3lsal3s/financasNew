import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordModal } from "./change-password-modal";

const mockChangeUserPassword = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  changeUserPassword: (...args: unknown[]) => mockChangeUserPassword(...args),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("ChangePasswordModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChangeUserPassword.mockResolvedValue(undefined);
  });

  it("renderiza os requisitos com PasswordRequirementsChecklist e valida confirmação", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Alterar Senha de Acesso")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Atualizar Senha/i });
    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/Senha atual/i), "SenhaAtual1");
    await user.type(screen.getByLabelText(/^Nova senha/i), "NovaSenha1");

    expect(screen.getByText("Pelo menos 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Letras maiúsculas ou números")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Confirmar nova senha/i), "Diferente1");

    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it("envia a nova senha ao preencher todos os requisitos corretamente", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ChangePasswordModal open={true} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/Senha atual/i), "SenhaAtual1");
    await user.type(screen.getByLabelText(/^Nova senha/i), "NovaSenha1");
    await user.type(screen.getByLabelText(/Confirmar nova senha/i), "NovaSenha1");

    const submitBtn = screen.getByRole("button", { name: /Atualizar Senha/i });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    expect(mockChangeUserPassword).toHaveBeenCalledWith("SenhaAtual1", "NovaSenha1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
