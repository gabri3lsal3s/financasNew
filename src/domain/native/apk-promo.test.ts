import { describe, expect, it } from "vitest";
import {
  shouldShowApkPromo,
  computeDismissUntilTimestamp,
  APK_PROMO_DISMISS_DAYS,
} from "./apk-promo";

describe("shouldShowApkPromo", () => {
  const baseDate = new Date("2026-10-20T12:00:00Z");

  it("não deve exibir se o usuário já estiver rodando o app nativo", () => {
    const result = shouldShowApkPromo({
      isNative: true,
      isAndroid: true,
      now: baseDate,
    });
    expect(result).toBe(false);
  });

  it("não deve exibir se o dispositivo não for Android (ex: iOS ou desktop)", () => {
    const result = shouldShowApkPromo({
      isNative: false,
      isAndroid: false,
      now: baseDate,
    });
    expect(result).toBe(false);
  });

  it("deve exibir para usuário Android em Web/PWA sem dispensa prévia", () => {
    const result = shouldShowApkPromo({
      isNative: false,
      isAndroid: true,
      now: baseDate,
    });
    expect(result).toBe(true);
  });

  it("não deve exibir se o aviso foi dispensado e ainda está dentro da janela de 7 dias", () => {
    const futureDate = new Date("2026-10-25T12:00:00Z").getTime();
    const result = shouldShowApkPromo({
      isNative: false,
      isAndroid: true,
      dismissedUntil: futureDate,
      now: baseDate,
    });
    expect(result).toBe(false);
  });

  it("deve voltar a exibir se a data de dispensa já expirou no passado", () => {
    const pastDate = new Date("2026-10-15T12:00:00Z").getTime();
    const result = shouldShowApkPromo({
      isNative: false,
      isAndroid: true,
      dismissedUntil: pastDate,
      now: baseDate,
    });
    expect(result).toBe(true);
  });
});

describe("computeDismissUntilTimestamp", () => {
  it("calcula corretamente a dispensa para 7 dias no futuro", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const ts = computeDismissUntilTimestamp(APK_PROMO_DISMISS_DAYS, now);
    const expected = new Date("2026-10-27T10:00:00Z").getTime();
    expect(ts).toBe(expected);
  });
});
