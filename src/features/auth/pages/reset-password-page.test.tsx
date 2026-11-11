import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordPage } from "./reset-password-page";
import * as toastModule from "@/services/toast";
import * as sensoryModule from "@/services/sensory";

const mockUnsubscribe = vi.fn();
type AuthListener = (event: string, session: unknown) => void;
let authListener: AuthListener | null = null;

const mockSubscribeAuthStateChange = vi.fn((callback: AuthListener) => {
  authListener = callback;
  return mockUnsubscribe;
});
const mockUpdateUserPassword = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/hooks/use-auth", () => ({
  subscribeAuthStateChange: (callback: AuthListener) => mockSubscribeAuthStateChange(callback),
  updateUserPassword: (pwd: string) => mockUpdateUserPassword(pwd),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
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
    authListener = null;
    mockSignOut.mockResolvedValue({ error: null });
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        search: "",
        hash: "",
        pathname: "/redefinir-senha",
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

  it("atualiza a senha com sucesso, invalida outras sessões e exibe tela de confirmação", async () => {
    const user = userEvent.setup();
    mockUpdateUserPassword.mockResolvedValueOnce(undefined);

    renderResetPasswordPage();

    await user.type(screen.getByLabelText("Nova senha"), "SenhaForte123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "SenhaForte123");

    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(mockUpdateUserPassword).toHaveBeenCalledWith("SenhaForte123");
      expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
      expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("success");
      expect(toastModule.pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(screen.getByText("Tudo pronto! Senha atualizada")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Acessar minha conta" })).toBeInTheDocument();
    });
  });

  it("invalida outras sessões ativas com fail-safe caso signOut lance erro", async () => {
    const user = userEvent.setup();
    mockUpdateUserPassword.mockResolvedValueOnce(undefined);
    mockSignOut.mockRejectedValueOnce(new Error("Supabase auth error"));

    renderResetPasswordPage();

    await user.type(screen.getByLabelText("Nova senha"), "SenhaForte123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "SenhaForte123");

    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(mockUpdateUserPassword).toHaveBeenCalledWith("SenhaForte123");
      expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
      expect(screen.getByText("Tudo pronto! Senha atualizada")).toBeInTheDocument();
    });
  });

  it("higieniza a URL removendo tokens do histórico ao inicializar com parâmetros de recuperação", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        search: "",
        hash: "#access_token=token-xyz&type=recovery&refresh_token=refresh-xyz",
        pathname: "/redefinir-senha",
        origin: "http://localhost:3000",
      },
    });

    renderResetPasswordPage();

    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, "/redefinir-senha");
  });

  it("higieniza a URL ao capturar o evento PASSWORD_RECOVERY via onAuthStateChange", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        search: "",
        hash: "#type=recovery",
        pathname: "/redefinir-senha",
        origin: "http://localhost:3000",
      },
    });

    renderResetPasswordPage();

    expect(authListener).toBeDefined();
    authListener?.("PASSWORD_RECOVERY", { user: { id: "user-123" } });

    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, "/redefinir-senha");
  });

  it("trata erro ou expiração do link passado na URL", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        search: "?error_code=otp_expired&error_description=Token%20expirou",
        hash: "",
        pathname: "/redefinir-senha",
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
