import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecurityTab } from "./security-tab";
import * as nativeServices from "@/services/native";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u-123", email: "teste@financas.app", user_metadata: { name: "Usuario Teste" } },
  }),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: vi.fn(),
  }),
}));

vi.mock("@/state", () => ({
  usePortfolioPosition: () => ({ rows: [] }),
  useExportData: () => ({ refetch: vi.fn() }),
  useRestoreBackup: () => ({ mutateAsync: vi.fn() }),
  useLoadDemoData: () => ({ mutate: vi.fn(), isPending: false }),
  useClearDemoData: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserAccess: () => ({
    role: "admin",
    hasFeature: () => true,
  }),
  useCategories: () => ({ data: [] }),
  useCreditCards: () => ({ data: [] }),
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

  it("permite alternar o Escudo de Privacidade", async () => {
    const user = userEvent.setup();
    renderSecurityTab();

    const privacyCheckbox = screen.getByRole("checkbox", {
      name: "Ativar escudo de privacidade contra capturas e visualização recente",
    });
    expect(privacyCheckbox).not.toBeChecked();

    await user.click(privacyCheckbox);

    expect(nativeServices.setPrivacyShieldEnabled).toHaveBeenCalledWith(true);
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

    expect(screen.getByText("Assistente de Restauração de Backup")).toBeInTheDocument();
    expect(screen.getByText("Validação")).toBeInTheDocument();
  });
});

