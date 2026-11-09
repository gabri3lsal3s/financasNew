import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GUEST_MEMBER_STORAGE_KEY_PREFIX,
  getPublicTripGuestStorageKey,
  usePublicTripGuestIdentity,
} from "./use-public-trip-guest-identity";

describe("usePublicTripGuestIdentity (Tarefa 2.1)", () => {
  const token = "token-viagem-123";
  const expectedKey = `${GUEST_MEMBER_STORAGE_KEY_PREFIX}${token}`;

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("gera a chave estável correta no localStorage", () => {
    expect(getPublicTripGuestStorageKey(token)).toBe("axis_guest_member_token-viagem-123");
  });

  it("inicia com activeMemberId nulo quando não há valor salvo no localStorage", () => {
    const { result } = renderHook(() => usePublicTripGuestIdentity(token));
    expect(result.current.activeMemberId).toBeNull();
  });

  it("recupera activeMemberId previamente salvo no localStorage para o token correspondente", () => {
    window.localStorage.setItem(expectedKey, "member-456");
    const { result } = renderHook(() => usePublicTripGuestIdentity(token));
    expect(result.current.activeMemberId).toBe("member-456");
  });

  it("ignora chaves de outros tokens", () => {
    window.localStorage.setItem("axis_guest_member_outro-token", "member-999");
    const { result } = renderHook(() => usePublicTripGuestIdentity(token));
    expect(result.current.activeMemberId).toBeNull();
  });

  it("setActiveMemberId atualiza o estado e persiste no localStorage sob a chave correta", () => {
    const { result } = renderHook(() => usePublicTripGuestIdentity(token));

    act(() => {
      result.current.setActiveMemberId("member-789");
    });

    expect(result.current.activeMemberId).toBe("member-789");
    expect(window.localStorage.getItem(expectedKey)).toBe("member-789");
  });

  it("setActiveMemberId com valor nulo remove a chave do localStorage e redefine activeMemberId para null", () => {
    window.localStorage.setItem(expectedKey, "member-456");
    const { result } = renderHook(() => usePublicTripGuestIdentity(token));

    expect(result.current.activeMemberId).toBe("member-456");

    act(() => {
      result.current.setActiveMemberId(null);
    });

    expect(result.current.activeMemberId).toBeNull();
    expect(window.localStorage.getItem(expectedKey)).toBeNull();
  });

  it("setActiveMemberId com string vazia ou espaços em branco limpa a chave do storage", () => {
    window.localStorage.setItem(expectedKey, "member-456");
    const { result } = renderHook(() => usePublicTripGuestIdentity(token));

    act(() => {
      result.current.setActiveMemberId("   ");
    });

    expect(result.current.activeMemberId).toBeNull();
    expect(window.localStorage.getItem(expectedKey)).toBeNull();
  });

  it("clearActiveMember remove o registro do localStorage e redefine activeMemberId para null", () => {
    window.localStorage.setItem(expectedKey, "member-456");
    const { result } = renderHook(() => usePublicTripGuestIdentity(token));

    act(() => {
      result.current.clearActiveMember();
    });

    expect(result.current.activeMemberId).toBeNull();
    expect(window.localStorage.getItem(expectedKey)).toBeNull();
  });

  it("sincroniza reativamente múltiplas instâncias do hook montadas simultaneamente com o mesmo token", () => {
    const hook1 = renderHook(() => usePublicTripGuestIdentity(token));
    const hook2 = renderHook(() => usePublicTripGuestIdentity(token));

    expect(hook1.result.current.activeMemberId).toBeNull();
    expect(hook2.result.current.activeMemberId).toBeNull();

    act(() => {
      hook1.result.current.setActiveMemberId("member-xyz");
    });

    expect(hook1.result.current.activeMemberId).toBe("member-xyz");
    expect(hook2.result.current.activeMemberId).toBe("member-xyz");

    act(() => {
      hook2.result.current.clearActiveMember();
    });

    expect(hook1.result.current.activeMemberId).toBeNull();
    expect(hook2.result.current.activeMemberId).toBeNull();
  });

  it("reage a eventos de storage disparados de outras abas", () => {
    const { result } = renderHook(() => usePublicTripGuestIdentity(token));
    expect(result.current.activeMemberId).toBeNull();

    act(() => {
      window.localStorage.setItem(expectedKey, "member-cross-tab");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: expectedKey,
          newValue: "member-cross-tab",
        })
      );
    });

    expect(result.current.activeMemberId).toBe("member-cross-tab");
  });

  it("reage à mudança da prop token lendo a identidade correspondente ao novo token", () => {
    window.localStorage.setItem("axis_guest_member_token-1", "m1");
    window.localStorage.setItem("axis_guest_member_token-2", "m2");

    let currentToken = "token-1";
    const { result, rerender } = renderHook(() => usePublicTripGuestIdentity(currentToken));

    expect(result.current.activeMemberId).toBe("m1");

    currentToken = "token-2";
    rerender();

    expect(result.current.activeMemberId).toBe("m2");
  });

  it("retorna activeMemberId nulo e não quebra se token for undefined, null ou vazio", () => {
    const hookUndef = renderHook(() => usePublicTripGuestIdentity(undefined));
    expect(hookUndef.result.current.activeMemberId).toBeNull();

    act(() => {
      hookUndef.result.current.setActiveMemberId("member-1");
      hookUndef.result.current.clearActiveMember();
    });
    expect(hookUndef.result.current.activeMemberId).toBeNull();

    const hookEmpty = renderHook(() => usePublicTripGuestIdentity("   "));
    expect(hookEmpty.result.current.activeMemberId).toBeNull();
  });

  it("lida defensivamente com falhas ou exceções de leitura/escrita no localStorage", () => {
    const originalGetItem = window.localStorage.getItem;
    const originalSetItem = window.localStorage.setItem;

    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage quota exceeded");
    });

    const { result } = renderHook(() => usePublicTripGuestIdentity(token));
    expect(result.current.activeMemberId).toBeNull();

    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("Permission denied");
    });

    expect(() => {
      act(() => {
        result.current.setActiveMemberId("member-err");
      });
    }).not.toThrow();

    window.localStorage.getItem = originalGetItem;
    window.localStorage.setItem = originalSetItem;
  });
});
