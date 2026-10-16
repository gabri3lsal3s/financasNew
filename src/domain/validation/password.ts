/**
 * Validador puro de requisitos de segurança de senha (Tarefa 41 / FASE 23).
 */
export interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  };
}

export function getPasswordStrength(requirements: PasswordRequirements): PasswordStrength {
  const metCount = Object.values(requirements).filter(Boolean).length;
  if (metCount === 0) return "empty";
  if (metCount <= 2) return "weak";
  if (metCount === 3) return "medium";
  return "strong";
}
