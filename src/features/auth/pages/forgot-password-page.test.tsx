import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "./forgot-password-page";
import * as authHook from "@/hooks/use-auth";
import * as sensoryModule from "@/services/sensory";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/components/ui/turnstile", () => ({
  Turnstile: ({
    onVerify,
    onExpire,
  }: {
    onVerify?: (token: string) => void;
    onExpire?: () => void;
  }) => (
    <div data-testid="turnstile-stub">
      <button
        type="button"
        data-testid="turnstile-trigger"
        onClick={() => onVerify?.("mock-turnstile-token-xyz")}
      >
        Simular Captcha
      </button>
      <button
        type="button"
        data-testid="turnstile-expire"
        onClick={() => onExpire?.()}
      >
        Expirar Captcha
      </button>
    </div>
  ),
}));

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe("ForgotPasswordPage - Recuperação de Senha e Anti-Enumeração", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza todos os elementos da página de recuperação", () => {
    renderForgotPasswordPage();

    expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeInTheDocument();
    expect(
      screen.getByText("Enviaremos um link de redefinição para o seu e-mail."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByTestId("turnstile-stub")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar link de recuperação" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar para o login/i })).toBeInTheDocument();
  });

  it("submete o e-mail sem captchaToken quando o Turnstile ainda não emitiu token", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.resetPasswordForEmail).mockResolvedValueOnce(undefined);

    renderForgotPasswordPage();

    await user.type(screen.getByLabelText("E-mail"), "usuario@exemplo.com");
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    expect(authHook.resetPasswordForEmail).toHaveBeenCalledWith(
      "usuario@exemplo.com",
      undefined,
    );
    expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("success");
    expect(
      screen.getByText(
        "Se o endereço estiver cadastrado, você receberá um link de redefinição em instantes.",
      ),
    ).toBeInTheDocument();
  });

  it("repassa o captchaToken retornado pelo Turnstile ao submeter a recuperação", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.resetPasswordForEmail).mockResolvedValueOnce(undefined);

    renderForgotPasswordPage();

    await user.type(screen.getByLabelText("E-mail"), "usuario@exemplo.com");
    await user.click(screen.getByTestId("turnstile-trigger"));
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    expect(authHook.resetPasswordForEmail).toHaveBeenCalledWith(
      "usuario@exemplo.com",
      "mock-turnstile-token-xyz",
    );
  });

  it("anula o captchaToken quando o Turnstile expira", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.resetPasswordForEmail).mockResolvedValueOnce(undefined);

    renderForgotPasswordPage();

    await user.type(screen.getByLabelText("E-mail"), "usuario@exemplo.com");
    await user.click(screen.getByTestId("turnstile-trigger"));
    await user.click(screen.getByTestId("turnstile-expire"));
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    expect(authHook.resetPasswordForEmail).toHaveBeenCalledWith(
      "usuario@exemplo.com",
      undefined,
    );
  });

  it("ativa cooldown de 60 segundos após envio bem-sucedido e bloqueia novos envios", async () => {
    vi.useFakeTimers();
    vi.mocked(authHook.resetPasswordForEmail).mockResolvedValueOnce(undefined);

    renderForgotPasswordPage();

    const emailInput = screen.getByLabelText("E-mail");
    const submitBtn = screen.getByRole("button", { name: "Enviar link de recuperação" });

    // Preenche input e clica sem userEvent por estarmos sob fakeTimers
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: "recuperar@exemplo.com" } });
      fireEvent.click(submitBtn);
    });

    expect(authHook.resetPasswordForEmail).toHaveBeenCalledWith(
      "recuperar@exemplo.com",
      undefined,
    );

    // Imediatamente após o envio, botão entra em cooldown de 60s
    expect(screen.getByRole("button", { name: /Aguarde 60s para reenviar/i })).toBeDisabled();

    // Avança 10 segundos
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole("button", { name: /Aguarde 50s para reenviar/i })).toBeDisabled();

    // Tentar clicar novamente durante o cooldown não dispara nova chamada
    act(() => {
      submitBtn.click();
    });
    expect(authHook.resetPasswordForEmail).toHaveBeenCalledTimes(1);

    // Avança os 50 segundos restantes
    act(() => {
      vi.advanceTimersByTime(50000);
    });

    // Botão é reabilitado com texto original
    const reenabledBtn = screen.getByRole("button", { name: "Enviar link de recuperação" });
    expect(reenabledBtn).not.toBeDisabled();
  });

  it("exibe mensagem de erro e emite sensory destrutivo em caso de falha, sem ativar cooldown", async () => {
    const user = userEvent.setup();
    vi.mocked(authHook.resetPasswordForEmail).mockRejectedValueOnce(
      new Error("Serviço temporariamente indisponível"),
    );

    renderForgotPasswordPage();

    await user.type(screen.getByLabelText("E-mail"), "falha@exemplo.com");
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    expect(sensoryModule.triggerSensory).toHaveBeenCalledWith("destructive");
    expect(screen.getByText("Serviço temporariamente indisponível")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar link de recuperação" }),
    ).not.toBeDisabled();
  });
});
