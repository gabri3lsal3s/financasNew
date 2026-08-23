import { describe, expect, it } from "vitest";
import { canManageRole, canManageUserStatus, isAccountAccessible } from "./roles";

describe("roles & permissions domain engine", () => {
  it("deve permitir que apenas superadmin gerencie roles", () => {
    expect(canManageRole("superadmin", "user", "admin")).toBe(true);
    expect(canManageRole("admin", "user", "admin")).toBe(false);
    expect(canManageRole("user", "user", "admin")).toBe(false);
  });

  it("deve validar se admin pode gerenciar status de usuários comuns mas não superadmins", () => {
    expect(canManageUserStatus("admin", "user")).toBe(true);
    expect(canManageUserStatus("admin", "admin")).toBe(true);
    expect(canManageUserStatus("admin", "superadmin")).toBe(false);

    expect(canManageUserStatus("superadmin", "superadmin")).toBe(true);
    expect(canManageUserStatus("user", "user")).toBe(false);
  });

  it("deve validar que apenas contas com status active são acessíveis", () => {
    expect(isAccountAccessible("active")).toBe(true);
    expect(isAccountAccessible("pending_approval")).toBe(false);
    expect(isAccountAccessible("suspended")).toBe(false);
    expect(isAccountAccessible("banned")).toBe(false);
  });
});
