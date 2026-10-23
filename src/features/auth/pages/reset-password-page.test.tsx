import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordPage } from "./reset-password-page";
import * as authData from "@/data/auth";
import * as toastModule from "@/services/toast";
import * as sensoryModule from "@/services/sensory";

const mockUnsubscribe = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: mockUnsubscribe } },
}));
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      getSession: mockGetSession,
    },
  }),
}));

vi.mock("@/data/auth", () => ({
  updateUserPassword: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

function renderResetPasswordPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe("ResetPasswordPage - Redefinição de Senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-123" } } as never },
    });
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        search: "",
        hash: "",
        origin: "http://localhost:3000",
      },
    });
  });

  it("renderiza campos de nova senha e confirmação", () => {
    renderResetPasswordPage();

    expect(screen.getByLabelText("Nova senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar nova senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeInTheDocument();
  });

  it("exibe aviso quando as senhas não coincidem", async () => {
    const user = userEvent.setup();
    renderResetPasswordPage();

    await user.type(screen.getByLabelText("Nova senha"), "SenhaForte123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "OutraSenha123");

    expect(screen.getByText("As senhas digitadas não coincidem.")).toBeInTheDocument();
  });

  it("atualiza a senha com sucesso e exibe tela de confirmação", async () => {
    const user = userEvent.setup();
    vi.mocked(authData.updateUserPassword).mockResolvedValueOnce();

    renderResetPasswordPage();

    await user.type(screen.getByLabelText("Nova senha"), "SenhaForte123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "SenhaForte123");

    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(authData.updateUserPassword).toHaveBeenCalledWith("SenhaForte123");
      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastModule.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(screen.getByText("Tudo pronto! Senha atualizada")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Acessar minha conta" })).toBeInTheDocument();
    });
  });

  it("trata erro ou expiração do link passado na URL", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        search: "?error_code=otp_expired&error_description=Token%20expirou",
        hash: "",
        origin: "http://localhost:3000",
      },
    });

    renderResetPasswordPage();

    expect(screen.getByText("Token expirou")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Solicitar novo link de recuperação" }),
    ).toBeInTheDocument();
  });
});
