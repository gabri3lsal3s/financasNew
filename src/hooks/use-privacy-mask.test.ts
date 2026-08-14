import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getPrivacyMasked,
  setPrivacyMasked,
  togglePrivacyMask,
  usePrivacyMask,
} from "./use-privacy-mask";

afterEach(() => {
  setPrivacyMasked(false);
});

describe("usePrivacyMask (F8 — Decisão 5)", () => {
  it("inicia desativado", () => {
    expect(getPrivacyMasked()).toBe(false);
    const { result } = renderHook(() => usePrivacyMask());
    expect(result.current).toBe(false);
  });

  it("toggle alterna o estado e notifica o hook", () => {
    const { result } = renderHook(() => usePrivacyMask());

    act(() => togglePrivacyMask());
    expect(getPrivacyMasked()).toBe(true);
    expect(result.current).toBe(true);

    act(() => togglePrivacyMask());
    expect(result.current).toBe(false);
  });

  it("set com o mesmo valor não notifica", () => {
    const { result } = renderHook(() => usePrivacyMask());
    act(() => setPrivacyMasked(true));
    act(() => setPrivacyMasked(true));
    expect(result.current).toBe(true);
  });
});
