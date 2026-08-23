import type { UserRole, UserStatus } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Usuário Padrão",
  admin: "Administrador",
  superadmin: "Super Administrador",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  pending_approval: "Aguardando Aprovação",
  active: "Ativo",
  suspended: "Suspenso",
  banned: "Banido",
};

/**
 * Avalia se o usuário atual tem permissão para gerenciar a role de um alvo.
 * Apenas Superadmin pode promover/rebaixar para Superadmin ou alterar outro Superadmin.
 */
export function canManageRole(
  currentUserRole: UserRole,
  targetUserRole: UserRole,
  newRole?: UserRole,
): boolean {
  if (currentUserRole !== "superadmin") {
    return false;
  }
  if (targetUserRole === "superadmin" && newRole !== "superadmin") {
    return true; // Superadmin pode rebaixar outro superadmin
  }
  return true;
}

/**
 * Avalia se o usuário atual pode suspender, banir ou aprovar um usuário alvo.
 * Admins não podem suspender ou banir Superadmins.
 */
export function canManageUserStatus(
  currentUserRole: UserRole,
  targetUserRole: UserRole,
): boolean {
  if (currentUserRole === "superadmin") return true;
  if (currentUserRole === "admin") {
    return targetUserRole !== "superadmin";
  }
  return false;
}

/**
 * Determina se o status da conta permite login e operação normal no app.
 */
export function isAccountAccessible(status: UserStatus): boolean {
  return status === "active";
}
