import { beforeEach, describe, expect, it, vi } from "vitest";
import { resendConfirmationEmail, resetPasswordForEmail, signInWithEmail, signUpWithEmail, updateUserPassword } from "./auth";
import { getPublicAppUrl } from "@/lib/env";
import { AppError } from "@/services/errors";

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockResend = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
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
        message: expect.stringContaining("já está cadastrado no Áxis Finance"),
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
    it("chama auth.resetPasswordForEmail apontando para /redefinir-senha", async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
      await resetPasswordForEmail("recuperar@exemplo.com");

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith("recuperar@exemplo.com", {
        redirectTo: `${window.location.origin}/redefinir-senha`,
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
});
