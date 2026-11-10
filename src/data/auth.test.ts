import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeUserPassword,
  requestUserEmailChange,
  resendConfirmationEmail,
  resetPasswordForEmail,
  signInWithEmail,
  signUpWithEmail,
  updateUserPassword,
  verifyCurrentPassword,
} from "./auth";
import { getPublicAppUrl } from "@/lib/env";
import { AppError } from "@/services/errors";

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockResend = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

describe("data/auth — operações de autenticação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signInWithEmail", () => {
    it("conclui com sucesso normalizando e-mail e sem options quando captchaToken omitido", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });
      await expect(signInWithEmail("  TESTE@EXEMPLO.COM  ", "senha123")).resolves.toBeUndefined();

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "teste@exemplo.com",
        password: "senha123",
        options: undefined,
      });
    });

    it("repassa captchaToken em options quando fornecido", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });
      await expect(
        signInWithEmail("teste@exemplo.com", "senha123", "turnstile-token-abc"),
      ).resolves.toBeUndefined();

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "teste@exemplo.com",
        password: "senha123",
        options: { captchaToken: "turnstile-token-abc" },
      });
    });

    it("lança AppError formatado quando a autenticação falha", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        error: { message: "Invalid login credentials", status: 400 },
      });
      await expect(signInWithEmail("teste@exemplo.com", "errada")).rejects.toThrow(AppError);
    });
  });

  describe("signUpWithEmail", () => {
    it("normaliza e-mail, sanitiza nome/código e repassa captchaToken e emailRedirectTo universal", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const result = await signUpWithEmail(
        "  NOVO.USUARIO@EXEMPLO.COM  ",
        "senha123",
        "  <script>alert(1)</script>Gabriel Sales  ",
        " convite-vip ",
        "turnstile-token-xyz",
      );

      expect(result.needsEmailConfirmation).toBe(true);
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "novo.usuario@exemplo.com",
        password: "senha123",
        options: {
          data: {
            name: "alert(1)Gabriel Sales",
            invite_code: "CONVITE-VIP",
            app_mode: "investor",
          },
          emailRedirectTo: getPublicAppUrl("/entrar"),
          captchaToken: "turnstile-token-xyz",
        },
      });
    });

    it("define captchaToken como undefined quando omitido", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      await signUpWithEmail("teste@exemplo.com", "senha123");

      expect(mockSignUp).toHaveBeenCalledWith({
        email: "teste@exemplo.com",
        password: "senha123",
        options: {
          data: {
            name: "",
            invite_code: "",
            app_mode: "investor",
          },
          emailRedirectTo: getPublicAppUrl("/entrar"),
          captchaToken: undefined,
        },
      });
    });

    it("retorna needsEmailConfirmation: false quando session for criada imediatamente", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { session: { access_token: "tok" } },
        error: null,
      });
      const result = await signUpWithEmail("teste@exemplo.com", "senha123", "Gabriel");
      expect(result.needsEmailConfirmation).toBe(false);
    });

    it("lança AppError('user-already-exists') quando anti-enumeração retorna identities vazio", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          session: null,
          user: { id: "user-123", email: "jaexiste@exemplo.com", identities: [] },
        },
        error: null,
      });

      await expect(
        signUpWithEmail("jaexiste@exemplo.com", "senha123", "Gabriel"),
      ).rejects.toMatchObject({
        kind: "user-already-exists",
        message: expect.stringContaining("já está cadastrado no Axir"),
      });
    });

    it("lança AppError quando a chamada signUp falha", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { session: null },
        error: { message: "Signup disabled", status: 400 },
      });

      await expect(
        signUpWithEmail("teste@exemplo.com", "senha123", "Gabriel"),
      ).rejects.toThrow(AppError);
    });
  });

  describe("resetPasswordForEmail", () => {
    it("chama auth.resetPasswordForEmail apontando para /redefinir-senha com getPublicAppUrl e email normalizado", async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
      await resetPasswordForEmail("  RECUPERAR@EXEMPLO.COM  ");

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith("recuperar@exemplo.com", {
        redirectTo: getPublicAppUrl("/redefinir-senha"),
        captchaToken: undefined,
      });
    });

    it("repassa captchaToken nas opções quando fornecido", async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
      await resetPasswordForEmail("recuperar@exemplo.com", "token-captcha-123");

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith("recuperar@exemplo.com", {
        redirectTo: getPublicAppUrl("/redefinir-senha"),
        captchaToken: "token-captcha-123",
      });
    });

    it("lança AppError caso ocorra falha na solicitação", async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({
        error: { message: "Rate limit exceeded", status: 429 },
      });
      await expect(resetPasswordForEmail("recuperar@exemplo.com")).rejects.toThrow(AppError);
    });
  });

  describe("resendConfirmationEmail", () => {
    it("chama auth.resend com type: 'signup', e-mail normalizado e getPublicAppUrl", async () => {
      mockResend.mockResolvedValueOnce({ error: null });
      await resendConfirmationEmail("  PENDENTE@EXEMPLO.COM  ");

      expect(mockResend).toHaveBeenCalledWith({
        type: "signup",
        email: "pendente@exemplo.com",
        options: {
          emailRedirectTo: getPublicAppUrl("/entrar"),
        },
      });
    });

    it("lança AppError quando a API falha", async () => {
      mockResend.mockResolvedValueOnce({
        error: { message: "Too many requests", status: 429 },
      });
      await expect(resendConfirmationEmail("pendente@exemplo.com")).rejects.toThrow(AppError);
    });
  });

  describe("updateUserPassword", () => {
    it("chama auth.updateUser com o novo password", async () => {
      mockUpdateUser.mockResolvedValueOnce({ error: null });
      await updateUserPassword("NovaSenhaForte@2026");

      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "NovaSenhaForte@2026",
      });
    });

    it("lança AppError quando o Supabase rejeita a nova senha", async () => {
      mockUpdateUser.mockResolvedValueOnce({
        error: { message: "Password should be different from current password", status: 422 },
      });
      await expect(updateUserPassword("NovaSenhaForte@2026")).rejects.toThrow(AppError);
    });
  });

  describe("verifyCurrentPassword", () => {
    it("retorna true quando a senha atual é válida", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: "usuario@exemplo.com" } },
      });
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });

      const isValid = await verifyCurrentPassword("senhaAtualCorreta123");
      expect(isValid).toBe(true);
      expect(mockGetUser).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "usuario@exemplo.com",
        password: "senhaAtualCorreta123",
      });
    });

    it("retorna false quando a senha atual é incorreta", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: "usuario@exemplo.com" } },
      });
      mockSignInWithPassword.mockResolvedValueOnce({
        error: { message: "Invalid login credentials", status: 400 },
      });

      const isValid = await verifyCurrentPassword("senhaErrada");
      expect(isValid).toBe(false);
    });

    it("lança AppError('session-expired') quando não há usuário ativo", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
      });

      await expect(verifyCurrentPassword("senha123")).rejects.toMatchObject({
        kind: "session-expired",
      });
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it("lança AppError('session-expired') quando o usuário não possui e-mail", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: null } },
      });

      await expect(verifyCurrentPassword("senha123")).rejects.toMatchObject({
        kind: "session-expired",
      });
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe("changeUserPassword", () => {
    it("valida a senha atual e altera para a nova senha com sucesso", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: "usuario@exemplo.com" } },
      });
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });
      mockUpdateUser.mockResolvedValueOnce({ error: null });

      await changeUserPassword("SenhaAtual123", "NovaSenhaForte@2026");

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "usuario@exemplo.com",
        password: "SenhaAtual123",
      });
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "NovaSenhaForte@2026",
      });
    });

    it("lança AppError('invalid-credentials') e não altera a senha se a senha atual for incorreta", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: "usuario@exemplo.com" } },
      });
      mockSignInWithPassword.mockResolvedValueOnce({
        error: { message: "Invalid credentials", status: 400 },
      });

      await expect(
        changeUserPassword("SenhaIncorreta", "NovaSenhaForte@2026"),
      ).rejects.toMatchObject({
        kind: "invalid-credentials",
        message: "A senha atual informada está incorreta.",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("não altera a senha se a sessão estiver expirada", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
      });

      await expect(
        changeUserPassword("SenhaQualquer", "NovaSenhaForte@2026"),
      ).rejects.toMatchObject({
        kind: "session-expired",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("propaga erro caso updateUserPassword falhe após confirmação da senha atual", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: "usuario@exemplo.com" } },
      });
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });
      mockUpdateUser.mockResolvedValueOnce({
        error: { message: "Weak password", status: 422 },
      });

      await expect(
        changeUserPassword("SenhaAtual123", "fraca"),
      ).rejects.toThrow(AppError);
    });
  });

  describe("requestUserEmailChange", () => {
    it("reautentica com sucesso e solicita atualização de e-mail com getPublicAppUrl('/configuracoes?tab=conta') e e-mail normalizado", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: "usuario@exemplo.com" } },
      });
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });
      mockUpdateUser.mockResolvedValueOnce({ error: null });

      await requestUserEmailChange("MinhaSenha123", "  NOVO.EMAIL@EXEMPLO.COM  ");

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "usuario@exemplo.com",
        password: "MinhaSenha123",
      });
      expect(mockUpdateUser).toHaveBeenCalledWith(
        { email: "novo.email@exemplo.com" },
        { emailRedirectTo: getPublicAppUrl("/configuracoes?tab=conta") },
      );
    });

    it("lança AppError('invalid-credentials') e não chama updateUser se a senha atual for incorreta", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: "usuario@exemplo.com" } },
      });
      mockSignInWithPassword.mockResolvedValueOnce({
        error: { message: "Invalid credentials", status: 400 },
      });

      await expect(
        requestUserEmailChange("SenhaErrada", "novo@exemplo.com"),
      ).rejects.toMatchObject({
        kind: "invalid-credentials",
        message: "A senha atual informada está incorreta.",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("não chama updateUser se a sessão estiver expirada (getUser sem usuário)", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
      });

      await expect(
        requestUserEmailChange("Senha123", "novo@exemplo.com"),
      ).rejects.toMatchObject({
        kind: "session-expired",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("propaga AppError se updateUser retornar erro do Supabase", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { email: "usuario@exemplo.com" } },
      });
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });
      mockUpdateUser.mockResolvedValueOnce({
        error: { message: "Email rate limit exceeded", status: 429 },
      });

      await expect(
        requestUserEmailChange("MinhaSenha123", "novo@exemplo.com"),
      ).rejects.toThrow(AppError);
    });
  });
});
