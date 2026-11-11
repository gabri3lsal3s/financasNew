import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MfaModal } from "./mfa-modal";
import * as authHook from "@/hooks/use-auth";

vi.mock("@/hooks/use-auth", () => ({
  listVerifiedMfaFactors: vi.fn(),
  enrollMfaTotp: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfaFactor: vi.fn(),
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
});
