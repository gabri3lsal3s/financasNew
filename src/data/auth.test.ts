import { beforeEach, describe, expect, it, vi } from "vitest";
import { resendConfirmationEmail, resetPasswordForEmail, signInWithEmail, signUpWithEmail, updateUserPassword } from "./auth";
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
    it("conclui com sucesso ao receber credenciais válidas", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });
      await expect(signInWithEmail("teste@exemplo.com", "senha123")).resolves.toBeUndefined();
    });

    it("lança AppError formatado quando a autenticação falha", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        error: { message: "Invalid login credentials", status: 400 },
      });
      await expect(signInWithEmail("teste@exemplo.com", "errada")).rejects.toThrow(AppError);
    });
  });

  describe("signUpWithEmail", () => {
    it("retorna needsEmailConfirmation: true quando session for nula", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      const result = await signUpWithEmail("teste@exemplo.com", "senha123", "Gabriel");
      expect(result.needsEmailConfirmation).toBe(true);
    });

    it("retorna needsEmailConfirmation: false quando session for criada imediatamente", async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { session: { access_token: "tok" } },
        error: null,
      });
      const result = await signUpWithEmail("teste@exemplo.com", "senha123", "Gabriel");
      expect(result.needsEmailConfirmation).toBe(false);
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
    it("chama auth.resend com type: 'signup' e email", async () => {
      mockResend.mockResolvedValueOnce({ error: null });
      await resendConfirmationEmail("pendente@exemplo.com");

      expect(mockResend).toHaveBeenCalledWith({
        type: "signup",
        email: "pendente@exemplo.com",
        options: {
          emailRedirectTo: `${window.location.origin}/entrar`,
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
