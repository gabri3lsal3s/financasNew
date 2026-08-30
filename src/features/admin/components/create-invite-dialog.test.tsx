import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateInviteDialog } from "./create-invite-dialog";

const mockMutateAsync = vi.fn();

vi.mock("@/state", () => ({
  useAdminCreateModularInvite: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("CreateInviteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue("inv-id-123");
  });

  it("renderiza o formulário de geração de convite com código gerado", () => {
    render(<CreateInviteDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /Gerar Novo Convite de Acesso/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Código do Convite/i)).toBeInTheDocument();
    expect(screen.getByText(/Plano \/ Tier Atribuído ao Usuário/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar Convite/i })).toBeInTheDocument();
  });

  it("permite habilitar e configurar permissões modulares customizadas", async () => {
    const user = userEvent.setup();
    render(<CreateInviteDialog open={true} onOpenChange={vi.fn()} />);

    const checkbox = screen.getByLabelText(/Configurar Permissões Modulares Específicas/i);
    expect(checkbox).toBeInTheDocument();
    await user.click(checkbox);

    expect(screen.getByText("Transações & Lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Investimentos & Carteira")).toBeInTheDocument();
  });

  it("submete o convite com parâmetros corretos", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CreateInviteDialog open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: /Salvar Convite/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        code: expect.any(String),
        targetTier: "trial",
        maxUses: 1,
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
