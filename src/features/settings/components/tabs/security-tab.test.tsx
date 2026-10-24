import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecurityTab } from "./security-tab";
import * as nativeServices from "@/services/native";

const mockNavigate = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockDeleteCurrentUserAccount = vi.fn().mockResolvedValue(undefined);
const mockCancelSubscription = vi.fn().mockResolvedValue(undefined);

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u-123", email: "teste@financas.app", user_metadata: { name: "Usuario Teste" } },
  }),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}));

vi.mock("@/data/rpc", () => ({
  deleteCurrentUserAccount: () => mockDeleteCurrentUserAccount(),
  deleteOwnAccount: () => mockDeleteCurrentUserAccount(),
}));

vi.mock("@/data/repositories/billing", () => ({
  cancelSubscription: () => mockCancelSubscription(),
}));

const mockUpdateCustomSettings = vi.fn();

vi.mock("@/state", () => ({
  usePortfolioPosition: () => ({ rows: [] }),
  useExportData: () => ({ refetch: vi.fn() }),
  useRestoreBackup: () => ({ mutateAsync: vi.fn() }),
  useUserAccess: () => ({
    role: "admin",
    hasFeature: () => true,
  }),
  useCategories: () => ({ data: [] }),
  useCreditCards: () => ({ data: [] }),
  useUserPreferences: () => ({ data: { custom_settings: { privacyShieldEnabled: false } } }),
  useUpdateCustomSettings: () => ({ mutate: mockUpdateCustomSettings }),
}));

vi.mock("@/services/native", async () => {
  const actual = await vi.importActual<typeof nativeServices>("@/services/native");
  return {
    ...actual,
    checkBiometricsAvailability: vi.fn().mockResolvedValue({
      isAvailable: true,
      biometryType: "fingerprint",
      deviceIsSecure: true,
    }),
    authenticateWithBiometrics: vi.fn().mockResolvedValue({ success: true }),
    isBiometricLockEnabled: vi.fn().mockReturnValue(false),
    setBiometricLockEnabled: vi.fn(),
    getAppLockGraceMinutes: vi.fn().mockReturnValue(1),
    setAppLockGraceMinutes: vi.fn(),
    isPrivacyShieldEnabled: vi.fn().mockReturnValue(false),
    setPrivacyShieldEnabled: vi.fn().mockResolvedValue(undefined),
    isNativePlatform: vi.fn().mockReturnValue(true),
  };
});

function renderSecurityTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SecurityTab />
    </QueryClientProvider>,
  );
}

describe("SecurityTab - Bloqueio do Aplicativo & Privacidade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(true);
    vi.mocked(nativeServices.checkBiometricsAvailability).mockResolvedValue({
      isAvailable: true,
      biometryType: "fingerprint",
      deviceIsSecure: true,
    });
  });

  it("renderiza o card de Bloqueio do Aplicativo & Privacidade e badge de status", async () => {
    renderSecurityTab();

    expect(screen.getByText("Bloqueio do Aplicativo & Privacidade")).toBeInTheDocument();
    expect(screen.getByText("Exigir biometria ao retornar")).toBeInTheDocument();
    expect(screen.getByText("Escudo de Privacidade (Privacy Shield)")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Sensor Biométrico Ativo")).toBeInTheDocument();
    });
  });

  it("permite alternar o bloqueio biométrico com autenticação bem-sucedida", async () => {
    const user = userEvent.setup();
    renderSecurityTab();

    const biometricCheckbox = screen.getByRole("checkbox", {
      name: "Exigir biometria ao retornar ao aplicativo",
    });
    expect(biometricCheckbox).not.toBeChecked();

    await user.click(biometricCheckbox);

    expect(nativeServices.authenticateWithBiometrics).toHaveBeenCalled();
    expect(nativeServices.setBiometricLockEnabled).toHaveBeenCalledWith(true);
  });

  it("permite alternar o Escudo de Privacidade e sincronizar na nuvem", async () => {
    const user = userEvent.setup();
    renderSecurityTab();

    const privacyCheckbox = screen.getByRole("checkbox", {
      name: "Ativar escudo de privacidade contra capturas e visualização recente",
    });
    expect(privacyCheckbox).not.toBeChecked();

    await user.click(privacyCheckbox);

    expect(nativeServices.setPrivacyShieldEnabled).toHaveBeenCalledWith(true);
    expect(mockUpdateCustomSettings).toHaveBeenCalledWith({ privacyShieldEnabled: true });
  });

  it("permite alterar o tempo de tolerância para bloqueio quando a biometria está ativada", async () => {
    vi.mocked(nativeServices.isBiometricLockEnabled).mockReturnValue(true);
    const user = userEvent.setup();
    renderSecurityTab();

    expect(screen.getByText("Tolerância para bloqueio")).toBeInTheDocument();
    const selectTrigger = screen.getByRole("combobox", {
      name: "Selecione o tempo de tolerância para bloqueio",
    });
    expect(selectTrigger).toBeInTheDocument();

    await user.click(selectTrigger);
    const option5 = await screen.findByRole("option", { name: "Após 5 minutos em segundo plano" });
    await user.click(option5);

    expect(nativeServices.setAppLockGraceMinutes).toHaveBeenCalledWith(5);
  });

  it("permite abrir o assistente de restauração modular ao acionar a importação guiada", async () => {
    const user = userEvent.setup();
    renderSecurityTab();

    const openWizardBtn = screen.getByRole("button", { name: /Restaurar com Assistente/i });
    expect(openWizardBtn).toBeInTheDocument();

    await user.click(openWizardBtn);

    expect(await screen.findByText("Assistente de Restauração de Backup")).toBeInTheDocument();
    expect(await screen.findByText("Validação")).toBeInTheDocument();
  });

  describe("Ambiente Web / PWA (Ocultação de Recursos Nativos - Tarefa 1.1)", () => {
    it("não renderiza o card de Bloqueio do Aplicativo nem o Escudo de Privacidade na Web sem biometria", async () => {
      vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
      vi.mocked(nativeServices.checkBiometricsAvailability).mockResolvedValue({
        isAvailable: false,
        biometryType: "none",
        deviceIsSecure: false,
      });

      renderSecurityTab();

      // Aguarda qualquer tick e confirma que opções nativas inoperantes estão ocultas
      expect(screen.queryByText("Bloqueio do Aplicativo & Privacidade")).not.toBeInTheDocument();
      expect(screen.queryByText("Exigir biometria ao retornar")).not.toBeInTheDocument();
      expect(screen.queryByText("Escudo de Privacidade (Privacy Shield)")).not.toBeInTheDocument();
    });

    it("renderiza apenas biometria se houver suporte a autenticação de dispositivo na Web, mas nunca o Escudo de Privacidade", async () => {
      vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
      vi.mocked(nativeServices.checkBiometricsAvailability).mockResolvedValue({
        isAvailable: true,
        biometryType: "fingerprint",
        deviceIsSecure: true,
      });

      renderSecurityTab();

      // Aguarda resolução da biometria
      expect(await screen.findByText("Bloqueio do Aplicativo & Privacidade")).toBeInTheDocument();
      expect(screen.getByText("Exigir biometria ao retornar")).toBeInTheDocument();

      // Escudo de privacidade (FLAG_SECURE) NUNCA deve ser exibido em Web/PWA
      expect(screen.queryByText("Escudo de Privacidade (Privacy Shield)")).not.toBeInTheDocument();
    });
  });

  describe("Zona de Perigo / Exclusão de Conta (LGPD Art. 18, VI)", () => {
    it("renderiza o card de Zona de Perigo com descrição da LGPD e botão de ação", () => {
      renderSecurityTab();

      expect(
        screen.getByText("Zona de Perigo / Exclusão de Conta (LGPD)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Direito ao Esquecimento garantido pelo Art. 18, VI da Lei Geral de Proteção de Dados (LGPD).",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Excluir Minha Conta/i }),
      ).toBeInTheDocument();
    });

    it("abre o modal de confirmação e mantém o botão desabilitado até a digitação da palavra EXCLUIR", async () => {
      const user = userEvent.setup();
      renderSecurityTab();

      const openDeleteModalBtn = screen.getByRole("button", { name: /Excluir Minha Conta/i });
      await user.click(openDeleteModalBtn);

      expect(screen.getByText("Excluir Conta Definitivamente (LGPD)")).toBeInTheDocument();

      const confirmBtn = screen.getByRole("button", { name: /Confirmar Exclusão/i });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText("EXCLUIR");

      // Digita palavra incorreta
      await user.type(input, "CANCELAR");
      expect(confirmBtn).toBeDisabled();

      // Digita palavra correta "EXCLUIR"
      await user.clear(input);
      await user.type(input, "EXCLUIR");
      expect(confirmBtn).not.toBeDisabled();
    });

    it("executa cancelamento preventivo no gateway, exclusão no RPC, limpeza de storage e redireciona ao confirmar", async () => {
      const user = userEvent.setup();
      renderSecurityTab();

      await user.click(screen.getByRole("button", { name: /Excluir Minha Conta/i }));

      const input = screen.getByPlaceholderText("EXCLUIR");
      await user.type(input, "EXCLUIR");

      const confirmBtn = screen.getByRole("button", { name: /Confirmar Exclusão/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(mockCancelSubscription).toHaveBeenCalledTimes(1);
        expect(mockDeleteCurrentUserAccount).toHaveBeenCalledTimes(1);
        expect(mockSignOut).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith("/entrar", { replace: true });
      });
    });

    it("exibe mensagem de erro na modal caso o expurgo da conta falhe", async () => {
      mockDeleteCurrentUserAccount.mockRejectedValueOnce(
        new Error("Falha de conexão com o banco de dados."),
      );

      const user = userEvent.setup();
      renderSecurityTab();

      await user.click(screen.getByRole("button", { name: /Excluir Minha Conta/i }));

      const input = screen.getByPlaceholderText("EXCLUIR");
      await user.type(input, "EXCLUIR");

      const confirmBtn = screen.getByRole("button", { name: /Confirmar Exclusão/i });
      await user.click(confirmBtn);

      expect(
        await screen.findByText("Falha de conexão com o banco de dados."),
      ).toBeInTheDocument();
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});


