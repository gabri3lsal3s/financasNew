import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { setCachedIconTier } from "@/services/native/app-icon";
import { useIsPro } from "./use-is-pro";

describe("useIsPro Hook & Cache Resolution", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna true imediatamente se overridePro for true", () => {
    const { result } = renderHook(() => useIsPro(true));
    expect(result.current).toBe(true);
  });

  it("retorna false imediatamente se overridePro for false", () => {
    setCachedIconTier("PRO");
    const { result } = renderHook(() => useIsPro(false));
    expect(result.current).toBe(false);
  });

  it("lê o cache local ('PRO') na montagem imediata fora do provider para evitar piscadas visuais", () => {
    setCachedIconTier("PRO");
    const { result } = renderHook(() => useIsPro());
    expect(result.current).toBe(true);
  });

  it("lê o cache local ('FREE') na montagem imediata fora do provider quando não é Pro", () => {
    setCachedIconTier("FREE");
    const { result } = renderHook(() => useIsPro());
    expect(result.current).toBe(false);
  });

  it("retorna false quando o cache local estiver vazio", () => {
    const { result } = renderHook(() => useIsPro());
    expect(result.current).toBe(false);
  });
});
