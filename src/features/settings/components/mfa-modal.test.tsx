import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MfaModal } from "./mfa-modal";
import * as authHook from "@/hooks/use-auth";

vi.mock("@/hooks/use-auth", () => ({
  listVerifiedMfaFactors: vi.fn(),
  enrollMfaTotp: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfaFactor: vi.fn(),
  verifyMfaTotpCode: vi.fn(),
  verifyCurrentPassword: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("MfaModal — Governança de 2FA / TOTP (Fase 3)", () => {
  const onOpenChangeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o modal quando aberto e exibe botão de configuração quando não há fator ativo", async () => {
    vi.mocked(authHook.listVerifiedMfaFactors).mockResolvedValue(null);

    render(<MfaModal open={true} onOpenChange={onOpenChangeMock} />);

    expect(screen.getByRole("heading", { name: /Autenticação em Duas Etapas \(2FA\)/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Configurar 2FA/i })).toBeInTheDocument();
    });
  });

  it("exibe badge de protegido e botão de desativar quando fator TOTP estiver verificado", async () => {
    vi.mocked(authHook.listVerifiedMfaFactors).mockResolvedValue({
      id: "factor-123",
      status: "verified",
      friendly_name: "Google Authenticator",
      factor_type: "totp",
    });

    render(<MfaModal open={true} onOpenChange={onOpenChangeMock} />);

    await waitFor(() => {
      expect(screen.getByText("App Autenticador")).toBeInTheDocument();
      expect(screen.getByText("Ativo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Desativar 2FA/i })).toBeInTheDocument();
    });
  });

  it("inicia fluxo de cadastro ao clicar em Configurar 2FA", async () => {
    vi.mocked(authHook.listVerifiedMfaFactors).mockResolvedValue(null);
    vi.mocked(authHook.enrollMfaTotp).mockResolvedValue({
      factorId: "factor-new",
      secret: "JBSWY3DPEHPK3PXP",
      totpUri: "otpauth://totp/Axir:teste?secret=JBSWY3DPEHPK3PXP",
    });

    render(<MfaModal open={true} onOpenChange={onOpenChangeMock} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Configurar 2FA/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Configurar 2FA/i }));

    await waitFor(() => {
      expect(authHook.enrollMfaTotp).toHaveBeenCalledWith("Axir");
      expect(screen.getByText(/Escaneie o QR Code no seu aplicativo/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ativar 2FA/i })).toBeInTheDocument();
    });
  });

  it("exige confirmação de código TOTP ao clicar em Desativar 2FA antes de desvincular", async () => {
    vi.mocked(authHook.listVerifiedMfaFactors).mockResolvedValue({
      id: "factor-123",
      status: "verified",
      friendly_name: "Google Authenticator",
      factor_type: "totp",
    });
    vi.mocked(authHook.verifyMfaTotpCode).mockResolvedValue(true);
    vi.mocked(authHook.unenrollMfaFactor).mockResolvedValue(undefined);

    render(<MfaModal open={true} onOpenChange={onOpenChangeMock} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Desativar 2FA/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reconfigurar 2FA/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Desativar 2FA/i }));

    await waitFor(() => {
      expect(screen.getByText("Confirmar Desativação do 2FA")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar Desativação/i })).toBeInTheDocument();
    });

    // Digita o código de 6 dígitos
    const codeInput = screen.getByPlaceholderText("000000");
    fireEvent.change(codeInput, { target: { value: "654321" } });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar Desativação/i }));

    await waitFor(() => {
      expect(authHook.verifyMfaTotpCode).toHaveBeenCalledWith("factor-123", "654321");
      expect(authHook.unenrollMfaFactor).toHaveBeenCalledWith("factor-123");
    });
  });

  it("exige confirmação de segurança ao clicar em Reconfigurar 2FA e inicia novo cadastro", async () => {
    vi.mocked(authHook.listVerifiedMfaFactors).mockResolvedValue({
      id: "factor-123",
      status: "verified",
      friendly_name: "Google Authenticator",
      factor_type: "totp",
    });
    vi.mocked(authHook.verifyMfaTotpCode).mockResolvedValue(true);
    vi.mocked(authHook.unenrollMfaFactor).mockResolvedValue(undefined);
    vi.mocked(authHook.enrollMfaTotp).mockResolvedValue({
      factorId: "factor-novo",
      secret: "NOVOSEGREDO12345",
      totpUri: "otpauth://totp/Axir:novo?secret=NOVOSEGREDO12345",
    });

    render(<MfaModal open={true} onOpenChange={onOpenChangeMock} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reconfigurar 2FA/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Reconfigurar 2FA/i }));

    await waitFor(() => {
      expect(screen.getByText("Confirmar Reconfiguração do 2FA")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Gerar Novo QR Code/i })).toBeInTheDocument();
    });

    const codeInput = screen.getByPlaceholderText("000000");
    fireEvent.change(codeInput, { target: { value: "112233" } });

    fireEvent.click(screen.getByRole("button", { name: /Gerar Novo QR Code/i }));

    await waitFor(() => {
      expect(authHook.verifyMfaTotpCode).toHaveBeenCalledWith("factor-123", "112233");
      expect(authHook.unenrollMfaFactor).toHaveBeenCalledWith("factor-123");
      expect(authHook.enrollMfaTotp).toHaveBeenCalledWith("Axir");
      expect(screen.getByText("NOVOSEGREDO12345")).toBeInTheDocument();
    });
  });
});
