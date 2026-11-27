import { checkAdminPortalGrant } from "@/data/repositories/admin";

/**
 * Encapsula a consulta de concessão ativa do portal administrativo na camada @/state
 * (respeitando AGENTS.md §3 — componentes não acessam @/data diretamente).
 */
export function verifyAdminPortalGrant() {
  return checkAdminPortalGrant();
}
