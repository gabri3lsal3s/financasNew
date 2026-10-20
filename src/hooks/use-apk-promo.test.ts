import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApkPromo } from "./use-apk-promo";
import { APK_PROMO_STORAGE_KEY } from "@/domain/native";

vi.mock("@/services/native/platform", () => ({
  isNativePlatform: vi.fn(),
  isAndroidDevice: vi.fn(),
}));

import { isNativePlatform, isAndroidDevice } from "@/services/native/platform";

describe("useApkPromo", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("deve habilitar showPromo para Android não-nativo sem dispensa", () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.mocked(isAndroidDevice).mockReturnValue(true);

    const { result } = renderHook(() => useApkPromo());
    expect(result.current.showPromo).toBe(true);
  });

  it("não deve exibir se o usuário já estiver em app nativo", () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    vi.mocked(isAndroidDevice).mockReturnValue(true);

    const { result } = renderHook(() => useApkPromo());
    expect(result.current.showPromo).toBe(false);
  });

  it("não deve exibir para dispositivos não-Android", () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.mocked(isAndroidDevice).mockReturnValue(false);

    const { result } = renderHook(() => useApkPromo());
    expect(result.current.showPromo).toBe(false);
  });

  it("permite dispensar o aviso e salva a data no localStorage", () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.mocked(isAndroidDevice).mockReturnValue(true);

    const { result } = renderHook(() => useApkPromo());
    expect(result.current.showPromo).toBe(true);

    act(() => {
      result.current.dismiss(7);
    });

    expect(result.current.showPromo).toBe(false);
    const stored = localStorage.getItem(APK_PROMO_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(Number(stored)).toBeGreaterThan(Date.now());
  });
});
