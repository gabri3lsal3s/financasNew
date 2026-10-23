import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountTab } from "./account-tab";
import * as authHook from "@/hooks/use-auth";
import * as stateModule from "@/state";
import * as authData from "@/data/auth";
import * as toastModule from "@/services/toast";
import * as sensoryModule from "@/services/sensory";

const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/data/auth", () => ({
  updateUserPassword: vi.fn(),
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
});
