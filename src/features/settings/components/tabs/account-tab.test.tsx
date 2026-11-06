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
  changeUserPassword: vi.fn(),
  requestUserEmailChange: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  deleteOwnAccount: vi.fn(),
  deleteCurrentUserAccount: vi.fn(),
}));

vi.mock("@/data/repositories/billing", () => ({
  cancelSubscription: vi.fn(),
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
  useFamilyMode: () => ({
    isFamilyModeEnabled: false,
    toggleFamilyMode: vi.fn(),
    isLoading: false,
    isPending: false,
  }),
  useMyPublicShares: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMyFamily: () => ({
    data: null,
    isLoading: false,
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

  it("permite atualizar a senha exigindo a senha atual e validação de critérios", async () => {
    const user = userEvent.setup();
    vi.mocked(authData.changeUserPassword).mockResolvedValueOnce(undefined);

    renderAccountTab();

    const openPasswordModalButton = screen.getByRole("button", { name: "Alterar senha" });
    await user.click(openPasswordModalButton);

    const currentPasswordInput = screen.getByLabelText("Senha atual");
    const newPasswordInput = screen.getByLabelText("Nova senha");
    const confirmPasswordInput = screen.getByLabelText("Confirmar nova senha");
    const updatePasswordButton = screen.getByRole("button", { name: "Atualizar Senha" });

    expect(updatePasswordButton).toBeDisabled();

    // Sem a senha atual preenchida, o botão permanece desabilitado
    await user.type(newPasswordInput, "NovaSenhaForte123");
    await user.type(confirmPasswordInput, "NovaSenhaForte123");
    expect(updatePasswordButton).toBeDisabled();

    // Ao preencher a senha atual, habilita o botão
    await user.type(currentPasswordInput, "SenhaAtualValida123");
    expect(updatePasswordButton).not.toBeDisabled();

    await user.click(updatePasswordButton);

    await waitFor(() => {
      expect(authData.changeUserPassword).toHaveBeenCalledWith(
        "SenhaAtualValida123",
        "NovaSenhaForte123",
      );
      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastModule.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", title: "Senha atualizada com sucesso" }),
      );
    });
  });

  it("exibe aviso visual quando as senhas digitadas divergem", async () => {
    const user = userEvent.setup();
    renderAccountTab();

    const openPasswordModalButton = screen.getByRole("button", { name: "Alterar senha" });
    await user.click(openPasswordModalButton);

    const currentPasswordInput = screen.getByLabelText("Senha atual");
    const newPasswordInput = screen.getByLabelText("Nova senha");
    const confirmPasswordInput = screen.getByLabelText("Confirmar nova senha");
    const updatePasswordButton = screen.getByRole("button", { name: "Atualizar Senha" });

    await user.type(currentPasswordInput, "SenhaAtualValida123");
    await user.type(newPasswordInput, "NovaSenhaForte123");
    await user.type(confirmPasswordInput, "Diferente123");

    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(updatePasswordButton).toBeDisabled();
  });

  it("exibe mensagem de erro quando a alteração de senha falha na API", async () => {
    const user = userEvent.setup();
    vi.mocked(authData.changeUserPassword).mockRejectedValueOnce(
      new Error("A senha atual informada está incorreta."),
    );

    renderAccountTab();

    const openPasswordModalButton = screen.getByRole("button", { name: "Alterar senha" });
    await user.click(openPasswordModalButton);

    const currentPasswordInput = screen.getByLabelText("Senha atual");
    const newPasswordInput = screen.getByLabelText("Nova senha");
    const confirmPasswordInput = screen.getByLabelText("Confirmar nova senha");
    const updatePasswordButton = screen.getByRole("button", { name: "Atualizar Senha" });

    await user.type(currentPasswordInput, "SenhaErrada");
    await user.type(newPasswordInput, "NovaSenhaForte123");
    await user.type(confirmPasswordInput, "NovaSenhaForte123");

    await user.click(updatePasswordButton);

    await waitFor(() => {
      expect(screen.getByText("A senha atual informada está incorreta.")).toBeInTheDocument();
      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("destructive");
    });
  });

  it("limpa mensagem de erro ao digitar na senha atual", async () => {
    const user = userEvent.setup();
    vi.mocked(authData.changeUserPassword).mockRejectedValueOnce(
      new Error("A senha atual informada está incorreta."),
    );

    renderAccountTab();

    const openPasswordModalButton = screen.getByRole("button", { name: "Alterar senha" });
    await user.click(openPasswordModalButton);

    const currentPasswordInput = screen.getByLabelText("Senha atual");
    const newPasswordInput = screen.getByLabelText("Nova senha");
    const confirmPasswordInput = screen.getByLabelText("Confirmar nova senha");
    const updatePasswordButton = screen.getByRole("button", { name: "Atualizar Senha" });

    await user.type(currentPasswordInput, "SenhaErrada");
    await user.type(newPasswordInput, "NovaSenhaForte123");
    await user.type(confirmPasswordInput, "NovaSenhaForte123");

    await user.click(updatePasswordButton);

    await waitFor(() => {
      expect(screen.getByText("A senha atual informada está incorreta.")).toBeInTheDocument();
    });

    await user.type(currentPasswordInput, "1");
    expect(screen.queryByText("A senha atual informada está incorreta.")).not.toBeInTheDocument();
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

  describe("Alteração de E-mail", () => {
    it("renderiza o botão 'Alterar e-mail' ao lado do badge de verificado", () => {
      renderAccountTab();

      expect(screen.getByRole("button", { name: "Alterar e-mail" })).toBeInTheDocument();
      expect(screen.getByText("Verificado")).toBeInTheDocument();
    });

    it("abre o modal com os campos e aviso explicativo ao clicar no botão", async () => {
      const user = userEvent.setup();
      renderAccountTab();

      const openButton = screen.getByRole("button", { name: "Alterar e-mail" });
      await user.click(openButton);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Alterar E-mail de Acesso" })).toBeInTheDocument();
      expect(screen.getByLabelText("Novo endereço de e-mail")).toBeInTheDocument();
      expect(screen.getByLabelText("Senha atual", { selector: "#modal-email-current-password" })).toBeInTheDocument();
      expect(screen.getByText("Confirmação de Segurança")).toBeInTheDocument();
      expect(
        screen.getByText(/Por motivos de segurança, enviaremos links de confirmação/i),
      ).toBeInTheDocument();

      const confirmButton = screen.getByRole("button", { name: "Confirmar" });
      expect(confirmButton).toBeDisabled();
    });

    it("fecha o modal sem chamar requestUserEmailChange ao clicar em Cancelar", async () => {
      const user = userEvent.setup();
      renderAccountTab();

      const openButton = screen.getByRole("button", { name: "Alterar e-mail" });
      await user.click(openButton);

      const emailInput = screen.getByLabelText("Novo endereço de e-mail");
      const passwordInput = screen.getByLabelText("Senha atual", {
        selector: "#modal-email-current-password",
      });
      await user.type(emailInput, "novo@exemplo.com");
      await user.type(passwordInput, "SenhaSegura123");

      const cancelButton = screen.getByRole("button", { name: "Cancelar" });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "Alterar E-mail de Acesso" }),
        ).not.toBeInTheDocument();
      });
      expect(authData.requestUserEmailChange).not.toHaveBeenCalled();
    });

    it("impede solicitação caso o novo e-mail seja igual ao e-mail atual do usuário", async () => {
      const user = userEvent.setup();
      renderAccountTab();

      const openButton = screen.getByRole("button", { name: "Alterar e-mail" });
      await user.click(openButton);

      const emailInput = screen.getByLabelText("Novo endereço de e-mail");
      const passwordInput = screen.getByLabelText("Senha atual", {
        selector: "#modal-email-current-password",
      });
      await user.type(emailInput, "usuario@exemplo.com");
      await user.type(passwordInput, "SenhaSegura123");

      const confirmButton = screen.getByRole("button", { name: "Confirmar" });
      await user.click(confirmButton);

      expect(
        screen.getByText("O novo e-mail deve ser diferente do e-mail atual."),
      ).toBeInTheDocument();
      expect(authData.requestUserEmailChange).not.toHaveBeenCalled();
    });

    it("solicita alteração de e-mail com sucesso, exibindo toast e fechando o modal", async () => {
      const user = userEvent.setup();
      vi.mocked(authData.requestUserEmailChange).mockResolvedValueOnce(undefined);

      renderAccountTab();

      const openButton = screen.getByRole("button", { name: "Alterar e-mail" });
      await user.click(openButton);

      const emailInput = screen.getByLabelText("Novo endereço de e-mail");
      const passwordInput = screen.getByLabelText("Senha atual", {
        selector: "#modal-email-current-password",
      });
      await user.type(emailInput, "novomail@empresa.com");
      await user.type(passwordInput, "SenhaAtualCorreta123");

      const confirmButton = screen.getByRole("button", { name: "Confirmar" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(authData.requestUserEmailChange).toHaveBeenCalledWith(
          "SenhaAtualCorreta123",
          "novomail@empresa.com",
        );
        expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("success");
        expect(toastModule.pushToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Confirmação enviada",
            variant: "success",
          }),
        );
        expect(
          screen.queryByRole("heading", { name: "Alterar E-mail de Acesso" }),
        ).not.toBeInTheDocument();
      });
    });

    it("exibe mensagem de erro dentro do modal caso a requisição falhe na API", async () => {
      const user = userEvent.setup();
      vi.mocked(authData.requestUserEmailChange).mockRejectedValueOnce(
        new Error("A senha atual informada está incorreta."),
      );

      renderAccountTab();

      const openButton = screen.getByRole("button", { name: "Alterar e-mail" });
      await user.click(openButton);

      const emailInput = screen.getByLabelText("Novo endereço de e-mail");
      const passwordInput = screen.getByLabelText("Senha atual", {
        selector: "#modal-email-current-password",
      });
      await user.type(emailInput, "novomail@empresa.com");
      await user.type(passwordInput, "SenhaErrada123");

      const confirmButton = screen.getByRole("button", { name: "Confirmar" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("A senha atual informada está incorreta.")).toBeInTheDocument();
        expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("destructive");
        expect(
          screen.getByRole("heading", { name: "Alterar E-mail de Acesso" }),
        ).toBeInTheDocument();
      });
    });

    it("limpa mensagem de erro ao alterar o novo e-mail", async () => {
      const user = userEvent.setup();
      vi.mocked(authData.requestUserEmailChange).mockRejectedValueOnce(
        new Error("A senha atual informada está incorreta."),
      );

      renderAccountTab();

      const openButton = screen.getByRole("button", { name: "Alterar e-mail" });
      await user.click(openButton);

      const emailInput = screen.getByLabelText("Novo endereço de e-mail");
      const passwordInput = screen.getByLabelText("Senha atual", {
        selector: "#modal-email-current-password",
      });
      await user.type(emailInput, "novomail@empresa.com");
      await user.type(passwordInput, "SenhaErrada123");

      const confirmButton = screen.getByRole("button", { name: "Confirmar" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("A senha atual informada está incorreta.")).toBeInTheDocument();
      });

      await user.type(emailInput, ".br");
      expect(screen.queryByText("A senha atual informada está incorreta.")).not.toBeInTheDocument();
    });
  });

  describe("Sessão & Desconexão", () => {
    it("renderiza o card Sessão & Desconexão com botão Sair da Conta", () => {
      renderAccountTab();

      expect(screen.getByText("Sessão & Desconexão")).toBeInTheDocument();
      expect(screen.getByText("Sair da conta neste dispositivo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sair da Conta" })).toBeInTheDocument();
    });

    it("abre o modal de confirmação ao clicar em Sair da Conta", async () => {
      const user = userEvent.setup();
      renderAccountTab();

      const signOutButton = screen.getByRole("button", { name: "Sair da Conta" });
      await user.click(signOutButton);

      expect(screen.getByRole("heading", { name: "Encerrar Sessão" })).toBeInTheDocument();
      expect(
        screen.getByText("Tem certeza de que deseja sair da sua conta neste dispositivo?"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirmar Saída" })).toBeInTheDocument();
    });

    it("fecha o modal sem chamar signOut ao clicar em Cancelar", async () => {
      const user = userEvent.setup();
      renderAccountTab();

      const signOutButton = screen.getByRole("button", { name: "Sair da Conta" });
      await user.click(signOutButton);

      const cancelButton = screen.getByRole("button", { name: "Cancelar" });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Encerrar Sessão" })).not.toBeInTheDocument();
      });
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("chama signOut() e exibe toast de sucesso ao clicar em Confirmar Saída", async () => {
      const user = userEvent.setup();
      mockSignOut.mockResolvedValueOnce(undefined);

      renderAccountTab();

      const signOutButton = screen.getByRole("button", { name: "Sair da Conta" });
      await user.click(signOutButton);

      const confirmButton = screen.getByRole("button", { name: "Confirmar Saída" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
        expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("action");
        expect(toastModule.pushToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Sessão encerrada",
            description: "Você foi desconectado com sucesso deste dispositivo.",
          }),
        );
      });
    });

    it("permanece com o card Zona de Perigo como o último card da aba", () => {
      const { container } = renderAccountTab();

      const cards = container.querySelectorAll(".space-y-6 > div");
      expect(cards.length).toBeGreaterThanOrEqual(2);
      const lastCard = cards[cards.length - 1];
      expect(lastCard).toHaveTextContent("Zona de Perigo");
      expect(lastCard).toHaveTextContent("Excluir conta permanentemente");
    });
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

      const phraseInput = screen.getByPlaceholderText("EXCLUIR");
      await user.type(phraseInput, "OUTRA");
      expect(confirmButton).toBeDisabled();

      await user.clear(phraseInput);
      await user.type(phraseInput, "EXCLUIR");
      expect(confirmButton).not.toBeDisabled();
    });

    it("executa a exclusão da conta, encerra a sessão e redireciona para login ao confirmar com a frase exata", async () => {
      const user = userEvent.setup();
      vi.mocked(rpcData.deleteCurrentUserAccount).mockResolvedValueOnce(undefined);

      renderAccountTab();

      const openModalButton = screen.getByRole("button", { name: "Excluir Minha Conta" });
      await user.click(openModalButton);

      const phraseInput = screen.getByPlaceholderText("EXCLUIR");
      await user.type(phraseInput, "EXCLUIR");

      const confirmButton = screen.getByRole("button", { name: "Confirmar Exclusão" });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(rpcData.deleteCurrentUserAccount).toHaveBeenCalledTimes(1);
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
      vi.mocked(rpcData.deleteCurrentUserAccount).mockRejectedValueOnce(
        new Error("Erro interno ao deletar registros."),
      );

      renderAccountTab();

      const openModalButton = screen.getByRole("button", { name: "Excluir Minha Conta" });
      await user.click(openModalButton);

      const phraseInput = screen.getByPlaceholderText("EXCLUIR");
      await user.type(phraseInput, "EXCLUIR");

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
