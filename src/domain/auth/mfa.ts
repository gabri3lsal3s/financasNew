/**
 * Motor de domínio para Autenticação Multifator (MFA / 2FA) (§F47).
 *
 * Funções puras para validação de códigos TOTP, determinação de níveis
 * de garantia (AAL1 vs AAL2) e checagem de enforcement para cargos administrativos.
 */

import type { UserRole } from "@/types";

export type AuthenticatorAssuranceLevel = "aal1" | "aal2";

export interface MfaVerificationInput {
  code: string;
}

export interface MfaFactorSummary {
  id: string;
  friendlyName?: string;
  factorType: "totp";
  status: "verified" | "unverified";
  createdAt: string;
}

/**
 * Valida o formato de um código TOTP de 6 dígitos numéricos.
 */
export function isValidTotpCode(code: string): boolean {
  const cleaned = code.trim();
  return /^\d{6}$/.test(cleaned);
}

/**
 * Determina se um usuário com determinado cargo precisa de 2FA obrigatório
 * para acessar áreas restritas/administrativas do sistema.
 */
export function isMfaEnforcedForRole(role: UserRole): boolean {
  return role === "admin" || role === "superadmin";
}

/**
 * Determina se o nível de garantia atual atende ao requisito de acesso.
 * Se o cargo exigir 2FA e a conta possuir fatores ativos, exige AAL2.
 */
export function hasSufficientAal(
  currentAal: AuthenticatorAssuranceLevel,
  hasActiveTotp: boolean,
  role: UserRole,
): boolean {
  if (!hasActiveTotp) {
    // Se não tem TOTP cadastrado, AAL1 é aceito (a menos que a política de admin force o setup)
    return true;
  }
  if (isMfaEnforcedForRole(role)) {
    return currentAal === "aal2";
  }
  return true;
}

/**
 * Formata um código TOTP com espaço no meio (ex.: "123 456") para legibilidade.
 */
export function formatTotpDisplay(code: string): string {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}
