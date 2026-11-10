import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserCreateDialog } from "./user-create-dialog";

const mockProvisionMutateAsync = vi.fn();

vi.mock("@/state", () => ({
  useAdminPlans: () => ({
    data: [
      { id: "free", name: "Free", tier: "free" },
      { id: "pro", name: "Pro", tier: "pro" },
    ],
    isLoading: false,
  }),
  useAdminProvisionUser: () => ({
    mutateAsync: mockProvisionMutateAsync,
    isPending: false,
  }),
}));

describe("UserCreateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o formulário de provisionamento com todos os campos", () => {
    render(<UserCreateDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /Adicionar Novo Usuário/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome Completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail Corporativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefone \/ WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByText(/Nível de Acesso \(Cargo\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Plano Inicial Concedido/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cadastrar e Gerar Link/i })).toBeInTheDocument();
  });

  it("submete o formulário e exibe a tela de sucesso com o link de ativação gerado", async () => {
    const user = userEvent.setup();
    mockProvisionMutateAsync.mockResolvedValueOnce({
      userId: "new-user-123",
      email: "carlos@empresa.com",
      actionLink: "https://financas.app/#access_token=token-123&type=invite",
    });

    render(<UserCreateDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nome Completo/i), "Carlos Silva");
    await user.type(screen.getByLabelText(/E-mail Corporativo/i), "carlos@empresa.com");
    await user.type(screen.getByLabelText(/Telefone \/ WhatsApp/i), "11988887777");

    const submitBtn = screen.getByRole("button", { name: /Cadastrar e Gerar Link/i });
    await user.click(submitBtn);

    expect(mockProvisionMutateAsync).toHaveBeenCalledWith({
      name: "Carlos Silva",
      email: "carlos@empresa.com",
      phone: "11988887777",
      role: "user",
      plan_id: "trial",
      status: "active",
    });

    // Tela de sucesso
    expect(screen.getByRole("heading", { name: "Conta Provisionada com Sucesso" })).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://financas.app/#access_token=token-123&type=invite"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(screen.getByText("Despachar Link via WhatsApp do Cliente")).toBeInTheDocument();
  });
});
