import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountTab } from "./account-tab";
import * as authHook from "@/hooks/use-auth";
import * as stateModule from "@/state";
import * as authData from "@/data/auth";
import * as rpcData from "@/data/rpc";
import * as toastModule from "@/services/toast";
import * as sensoryModule from "@/services/sensory";

const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockNavigate = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/data/auth", () => ({
  updateUserPassword: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  deleteOwnAccount: vi.fn(),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({ signOut: mockSignOut }),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/state", () => ({
  useUserAccess: vi.fn(),
  useUserSubscription: vi.fn(),
  useUpdateProfile: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

function renderAccountTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AccountTab />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AccountTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authHook.useAuth).mockReturnValue({
      user: {
        id: "12345678-abcd-ef01-2345-6789abcdef01",
        email: "usuario@exemplo.com",
        created_at: "2026-01-15T10:00:00Z",
      } as never,
      session: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      resendConfirmation: vi.fn(),
    });

    vi.mocked(stateModule.useUserAccess).mockReturnValue({
      profile: {
        id: "12345678-abcd-ef01-2345-6789abcdef01",
        name: "Gabriel Santos",
        email: "usuario@exemplo.com",
        role: "admin",
        status: "active",
        created_at: "2026-01-15T10:00:00Z",
      },
      role: "admin",
      status: "active",
      features: {},
      isPendingApproval: false,
      isActive: true,
      isSuspended: false,
      isBanned: false,
      isAdmin: true,
      isSuperAdmin: false,
      hasFeature: vi.fn().mockReturnValue(true),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(stateModule.useUserSubscription).mockReturnValue({
      tier: "pro_monthly",
      isPro: true,
      isTrial: false,
      isFullAccess: true,
      trialDaysRemaining: null,
      trialEndsAt: null,
      currentPeriodEnd: "2026-12-01T00:00:00Z",
      plan: "pro_monthly" as never,
      cancelAtPeriodEnd: false,
      isLifetime: false,
      isReadOnly: false,
      canWrite: true,
    });
  });

  it("renderiza todos os dados iniciais do usuário", () => {
    renderAccountTab();

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Gabriel Santos");
    expect(screen.getByLabelText("Endereço de e-mail")).toHaveValue("usuario@exemplo.com");
    expect(screen.getByText("Verificado")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByText("Plano Pro Ativo")).toBeInTheDocument();
  });

  it("permite alterar e salvar o nome de exibição", async () => {
    const user = userEvent.setup();
    renderAccountTab();

    const nameInput = screen.getByLabelText("Nome completo");
    const saveButton = screen.getByRole("button", { name: "Salvar Alterações" });

    // Inicialmente sem modificação, botão fica desabilitado
    expect(saveButton).toBeDisabled();

    await user.clear(nameInput);
    await user.type(nameInput, "Gabriel Sales Atualizado");

    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        userId: "12345678-abcd-ef01-2345-6789abcdef01",
        name: "Gabriel Sales Atualizado",
      });
    });
  });

  it("permite atualizar a senha com validação de critérios", async () => {
    const user = userEvent.setup();
    vi.mocked(authData.updateUserPassword).mockResolvedValueOnce(undefined);

    renderAccountTab();

    const newPasswordInput = screen.getByLabelText("Nova senha");
    const confirmPasswordInput = screen.getByLabelText("Confirmar nova senha");
    const updatePasswordButton = screen.getByRole("button", { name: "Atualizar Senha" });

    expect(updatePasswordButton).toBeDisabled();

    await user.type(newPasswordInput, "NovaSenhaForte123");
    await user.type(confirmPasswordInput, "NovaSenhaForte123");

    expect(updatePasswordButton).not.toBeDisabled();
    await user.click(updatePasswordButton);

    await waitFor(() => {
      expect(authData.updateUserPassword).toHaveBeenCalledWith("NovaSenhaForte123");
      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastModule.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", title: "Senha atualizada" }),
      );
    });
  });

  it("exibe aviso visual quando as senhas digitadas divergem", async () => {
    const user = userEvent.setup();
    renderAccountTab();

    const newPasswordInput = screen.getByLabelText("Nova senha");
    const confirmPasswordInput = screen.getByLabelText("Confirmar nova senha");
    const updatePasswordButton = screen.getByRole("button", { name: "Atualizar Senha" });

    await user.type(newPasswordInput, "NovaSenhaForte123");
    await user.type(confirmPasswordInput, "Diferente123");

    expect(screen.getByText("As senhas digitadas não coincidem.")).toBeInTheDocument();
    expect(updatePasswordButton).toBeDisabled();
  });

  it("exibe mensagem de erro quando a alteração de senha falha na API", async () => {
    const user = userEvent.setup();
    vi.mocked(authData.updateUserPassword).mockRejectedValueOnce(new Error("Falha na rede"));

    renderAccountTab();

    const newPasswordInput = screen.getByLabelText("Nova senha");
    const confirmPasswordInput = screen.getByLabelText("Confirmar nova senha");
    const updatePasswordButton = screen.getByRole("button", { name: "Atualizar Senha" });

    await user.type(newPasswordInput, "NovaSenhaForte123");
    await user.type(confirmPasswordInput, "NovaSenhaForte123");

    await user.click(updatePasswordButton);

    await waitFor(() => {
      expect(screen.getByText("Falha na rede")).toBeInTheDocument();
      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("destructive");
    });
  });

  it("copia o ID da conta para o clipboard", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    renderAccountTab();

    const copyButton = screen.getByTitle("Copiar ID da conta");
    await user.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith("12345678-abcd-ef01-2345-6789abcdef01");
    expect(toastModule.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "ID copiado" }),
    );
  });

  describe("Zona de Perigo e Exclusão de Conta", () => {
    it("renderiza o card Zona de Perigo com aviso e botão de exclusão", () => {
      renderAccountTab();

      expect(screen.getByText("Zona de Perigo")).toBeInTheDocument();
      expect(screen.getByText("Excluir conta permanentemente")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Excluir Minha Conta" })).toBeInTheDocument();
    });

    it("abre o modal de confirmação e mantém o botão de confirmação desabilitado sem a frase exata", async () => {
      const user = userEvent.setup();
      renderAccountTab();

      const openModalButton = screen.getByRole("button", { name: "Excluir Minha Conta" });
      await user.click(openModalButton);

      expect(screen.getByText("Atenção: Ação Irreversível")).toBeInTheDocument();
      const confirmButton = screen.getByRole("button", { name: "Confirmar Exclusão" });
      expect(confirmButton).toBeDisabled();

      const phraseInput = screen.getByPlaceholderText("EXCLUIR MINHA CONTA");
      await user.type(phraseInput, "excluir minha conta"); // minúsculo não confere
      expect(confirmButton).toBeDisabled();

      await user.clear(phraseInput);
      await user.type(phraseInput, "EXCLUIR MINHA CONTA");
      expect(confirmButton).not.toBeDisabled();
    });

    it("executa a exclusão da conta, encerra a sessão e redireciona para login ao confirmar com a frase exata", async () => {
      const user = userEvent.setup();
      vi.mocked(rpcData.deleteOwnAccount).mockResolvedValueOnce(undefined);

      renderAccountTab();

      const openModalButton = screen.getByRole("button", { name: "Excluir Minha Conta" });
      await user.click(openModalButton);

      const phraseInput = screen.getByPlaceholderText("EXCLUIR MINHA CONTA");
      await user.type(phraseInput, "EXCLUIR MINHA CONTA");

      const confirmButton = screen.getByRole("button", { name: "Confirmar Exclusão" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(rpcData.deleteOwnAccount).toHaveBeenCalledTimes(1);
        expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("destructive");
        expect(mockSignOut).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith("/entrar", { replace: true });
        expect(toastModule.pushToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Conta excluída" }),
        );
      });
    });

    it("exibe mensagem de erro na modal caso a exclusão falhe", async () => {
      const user = userEvent.setup();
      vi.mocked(rpcData.deleteOwnAccount).mockRejectedValueOnce(
        new Error("Erro interno ao deletar registros."),
      );

      renderAccountTab();

      const openModalButton = screen.getByRole("button", { name: "Excluir Minha Conta" });
      await user.click(openModalButton);

      const phraseInput = screen.getByPlaceholderText("EXCLUIR MINHA CONTA");
      await user.type(phraseInput, "EXCLUIR MINHA CONTA");

      const confirmButton = screen.getByRole("button", { name: "Confirmar Exclusão" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Erro interno ao deletar registros.")).toBeInTheDocument();
        expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("destructive");
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });
  });
});
