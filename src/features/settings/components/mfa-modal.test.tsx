import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MfaModal } from "./mfa-modal";
import { getSupabase } from "@/data/client";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
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
    const listFactorsMock = vi.fn().mockResolvedValue({
      data: { totp: [], all: [] },
      error: null,
    });

    vi.mocked(getSupabase).mockReturnValue({
      auth: {
        mfa: {
          listFactors: listFactorsMock,
          enroll: vi.fn(),
          challengeAndVerify: vi.fn(),
          unenroll: vi.fn(),
        },
      },
    } as unknown as ReturnType<typeof getSupabase>);

    render(<MfaModal open={true} onOpenChange={onOpenChangeMock} />);

    expect(screen.getByRole("heading", { name: /Autenticação em Duas Etapas \(2FA\)/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Configurar 2FA/i })).toBeInTheDocument();
    });
  });

  it("exibe badge de protegido e botão de desativar quando fator TOTP estiver verificado", async () => {
    const listFactorsMock = vi.fn().mockResolvedValue({
      data: {
        totp: [
          {
            id: "factor-123",
            status: "verified",
            friendly_name: "Google Authenticator",
            factor_type: "totp",
          },
        ],
        all: [],
      },
      error: null,
    });

    vi.mocked(getSupabase).mockReturnValue({
      auth: {
        mfa: {
          listFactors: listFactorsMock,
          enroll: vi.fn(),
          challengeAndVerify: vi.fn(),
          unenroll: vi.fn(),
        },
      },
    } as unknown as ReturnType<typeof getSupabase>);

    render(<MfaModal open={true} onOpenChange={onOpenChangeMock} />);

    await waitFor(() => {
      expect(screen.getByText("App Autenticador")).toBeInTheDocument();
      expect(screen.getByText("Ativo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Desativar 2FA/i })).toBeInTheDocument();
    });
  });

  it("inicia fluxo de cadastro ao clicar em Configurar 2FA", async () => {
    const listFactorsMock = vi.fn().mockResolvedValue({
      data: { totp: [], all: [] },
      error: null,
    });

    const enrollMock = vi.fn().mockResolvedValue({
      data: {
        id: "factor-new",
        totp: {
          secret: "JBSWY3DPEHPK3PXP",
          uri: "otpauth://totp/Áxis%20Finance:teste?secret=JBSWY3DPEHPK3PXP",
        },
      },
      error: null,
    });

    vi.mocked(getSupabase).mockReturnValue({
      auth: {
        mfa: {
          listFactors: listFactorsMock,
          enroll: enrollMock,
          challengeAndVerify: vi.fn(),
          unenroll: vi.fn(),
        },
      },
    } as unknown as ReturnType<typeof getSupabase>);

    render(<MfaModal open={true} onOpenChange={onOpenChangeMock} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Configurar 2FA/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Configurar 2FA/i }));

    await waitFor(() => {
      expect(enrollMock).toHaveBeenCalledWith({
        factorType: "totp",
        issuer: "Áxis Finance",
      });
      expect(screen.getByText(/Escaneie o QR Code no seu aplicativo/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ativar 2FA/i })).toBeInTheDocument();
    });
  });
});
