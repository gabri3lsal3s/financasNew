import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActiveDevicesCard } from "./active-devices-card";
import type { UserDevice } from "@/types";

const mockCurrentDeviceId = "current-device-uuid-123";

vi.mock("@/services/native/device-info", () => ({
  getOrCreateDeviceId: () => mockCurrentDeviceId,
}));

const mockRevokeMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockRefetch = vi.fn();

let mockDevicesData: UserDevice[] = [];
let mockIsLoading = false;
let mockIsPendingRevoke = false;
let mockIsPendingDelete = false;

vi.mock("@/state", () => ({
  useDevices: () => ({
    data: mockDevicesData,
    isLoading: mockIsLoading,
    isFetching: false,
    refetch: mockRefetch,
  }),
  useRevokeDevice: () => ({
    mutateAsync: mockRevokeMutateAsync,
    isPending: mockIsPendingRevoke,
  }),
  useDeleteDevice: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: mockIsPendingDelete,
  }),
}));

const mockGetActiveUserMfaFactor = vi.fn();
const mockVerifyMfaTotpCode = vi.fn();
const mockVerifyCurrentPassword = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  getActiveUserMfaFactor: () => mockGetActiveUserMfaFactor(),
  verifyMfaTotpCode: (...args: unknown[]) => mockVerifyMfaTotpCode(...args),
  verifyCurrentPassword: (...args: unknown[]) => mockVerifyCurrentPassword(...args),
}));

const mockTriggerSensory = vi.fn();
vi.mock("@/services/sensory", () => ({
  triggerSensory: (...args: unknown[]) => mockTriggerSensory(...args),
}));

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveDevicesCard />
    </QueryClientProvider>,
  );
}

describe("ActiveDevicesCard — Painel de Dispositivos Conectados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockIsPendingRevoke = false;
    mockIsPendingDelete = false;

    mockDevicesData = [
      {
        id: "rec-1",
        user_id: "user-1",
        device_id: mockCurrentDeviceId,
        device_name: "Google Chrome no Linux",
        browser: "Google Chrome",
        os: "Linux",
        ip_address: "192.168.1.10",
        last_seen_at: "2026-11-11T10:00:00.000Z",
        created_at: "2026-11-01T10:00:00.000Z",
        is_revoked: false,
      },
      {
        id: "rec-2",
        user_id: "user-1",
        device_id: "remote-device-phone-456",
        device_name: "Axir Android (Nativo)",
        browser: "App Axir Android",
        os: "Android",
        ip_address: "189.20.30.40",
        last_seen_at: "2026-11-10T15:30:00.000Z",
        created_at: "2026-11-05T12:00:00.000Z",
        is_revoked: false,
      },
      {
        id: "rec-3",
        user_id: "user-1",
        device_id: "remote-old-mac-789",
        device_name: "Safari no macOS",
        browser: "Safari",
        os: "macOS",
        ip_address: null,
        last_seen_at: "2026-10-20T08:00:00.000Z",
        created_at: "2026-10-01T08:00:00.000Z",
        is_revoked: true,
      },
    ];
  });

  it("renderiza o cabeçalho com contagem de dispositivos ativos", () => {
    renderCard();

    expect(screen.getByText("Dispositivos Conectados")).toBeInTheDocument();
    expect(screen.getByText("2 ativos")).toBeInTheDocument();
  });

  it("identifica o aparelho atual com badge distintivo e não exibe botão de revogar para ele", () => {
    renderCard();

    const currentBadge = screen.getByText("Dispositivo Atual");
    expect(currentBadge).toBeInTheDocument();

    const row = screen.getByTestId("device-row-rec-1");
    expect(row).toHaveTextContent("Google Chrome no Linux");
    expect(row).toHaveTextContent("Ativo agora");
    expect(row).toHaveTextContent("Sessão em uso");
    expect(row).not.toHaveTextContent("Revogar");
  });

  it("renderiza os aparelhos remotos com metadados e botão de revogação", () => {
    renderCard();

    const remoteRow = screen.getByTestId("device-row-rec-2");
    expect(remoteRow).toHaveTextContent("Axir Android (Nativo)");
    expect(remoteRow).toHaveTextContent("App Axir Android · Android");
    expect(remoteRow).toHaveTextContent("IP 189.20.30.40");

    const revokeButtons = screen.getAllByRole("button", { name: /revogar/i });
    expect(revokeButtons.length).toBe(1);
  });

  it("renderiza dispositivos revogados com badge distintivo e botão de remoção", () => {
    renderCard();

    const revokedRow = screen.getByTestId("device-row-rec-3");
    expect(revokedRow).toHaveTextContent("Safari no macOS");
    expect(revokedRow).toHaveTextContent("Sessão Revogada");

    const removeBtn = screen.getByRole("button", { name: /remover/i });
    expect(removeBtn).toBeInTheDocument();
  });

  it("permite revogar dispositivo remoto exigindo código TOTP quando o usuário tem 2FA ativo", async () => {
    mockGetActiveUserMfaFactor.mockResolvedValueOnce({ id: "factor-totp-123" });
    mockVerifyMfaTotpCode.mockResolvedValueOnce(true);
    mockRevokeMutateAsync.mockResolvedValueOnce(true);

    renderCard();

    const revokeBtn = screen.getByRole("button", { name: /revogar/i });
    fireEvent.click(revokeBtn);

    // Modal aberto
    await waitFor(() => {
      expect(screen.getByText("Revogar Dispositivo Remoto")).toBeInTheDocument();
      expect(screen.getByText("Código de Autenticação em Duas Etapas (2FA)")).toBeInTheDocument();
    });

    const totpInput = screen.getByLabelText(/Código de Autenticação em Duas Etapas/i);
    fireEvent.change(totpInput, { target: { value: "123456" } });

    const confirmBtn = screen.getByRole("button", { name: /Revogar Sessão/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockVerifyMfaTotpCode).toHaveBeenCalledWith("factor-totp-123", "123456");
      expect(mockRevokeMutateAsync).toHaveBeenCalledWith("rec-2");
      expect(mockTriggerSensory).toHaveBeenCalledWith("destructive");
    });
  });

  it("bloqueia revogação e exibe erro se o código TOTP for inválido", async () => {
    mockGetActiveUserMfaFactor.mockResolvedValueOnce({ id: "factor-totp-123" });
    mockVerifyMfaTotpCode.mockResolvedValueOnce(false);

    renderCard();

    const revokeBtn = screen.getByRole("button", { name: /revogar/i });
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(screen.getByText("Código de Autenticação em Duas Etapas (2FA)")).toBeInTheDocument();
    });

    const totpInput = screen.getByLabelText(/Código de Autenticação em Duas Etapas/i);
    fireEvent.change(totpInput, { target: { value: "000000" } });

    const confirmBtn = screen.getByRole("button", { name: /Revogar Sessão/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Código de autenticação incorreto ou expirado/i)).toBeInTheDocument();
      expect(mockRevokeMutateAsync).not.toHaveBeenCalled();
    });
  });

  it("permite revogar dispositivo remoto exigindo senha atual quando usuário NÃO tem 2FA ativo", async () => {
    mockGetActiveUserMfaFactor.mockResolvedValueOnce(null);
    mockVerifyCurrentPassword.mockResolvedValueOnce(true);
    mockRevokeMutateAsync.mockResolvedValueOnce(true);

    renderCard();

    const revokeBtn = screen.getByRole("button", { name: /revogar/i });
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(screen.getByText("Revogar Dispositivo Remoto")).toBeInTheDocument();
      expect(screen.getByText("Confirme sua Senha Atual")).toBeInTheDocument();
    });

    const pwdInput = screen.getByLabelText(/Confirme sua Senha Atual/i);
    fireEvent.change(pwdInput, { target: { value: "MinhaSenha123" } });

    const confirmBtn = screen.getByRole("button", { name: /Revogar Sessão/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockVerifyCurrentPassword).toHaveBeenCalledWith("MinhaSenha123");
      expect(mockRevokeMutateAsync).toHaveBeenCalledWith("rec-2");
      expect(mockTriggerSensory).toHaveBeenCalledWith("destructive");
    });
  });

  it("bloqueia revogação e exibe erro se a senha atual for incorreta", async () => {
    mockGetActiveUserMfaFactor.mockResolvedValueOnce(null);
    mockVerifyCurrentPassword.mockResolvedValueOnce(false);

    renderCard();

    const revokeBtn = screen.getByRole("button", { name: /revogar/i });
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(screen.getByText("Confirme sua Senha Atual")).toBeInTheDocument();
    });

    const pwdInput = screen.getByLabelText(/Confirme sua Senha Atual/i);
    fireEvent.change(pwdInput, { target: { value: "SenhaErrada" } });

    const confirmBtn = screen.getByRole("button", { name: /Revogar Sessão/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Senha incorreta/i)).toBeInTheDocument();
      expect(mockRevokeMutateAsync).not.toHaveBeenCalled();
    });
  });

  it("permite remover registro de dispositivo revogado", async () => {
    mockDeleteMutateAsync.mockResolvedValueOnce(undefined);

    renderCard();

    const removeBtn = screen.getByRole("button", { name: /remover/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith("rec-3");
    });
  });

  it("aciona refetch ao clicar no botão de atualizar", () => {
    renderCard();

    const refreshBtn = screen.getByRole("button", { name: /Atualizar lista de dispositivos/i });
    fireEvent.click(refreshBtn);

    expect(mockRefetch).toHaveBeenCalled();
  });
});
