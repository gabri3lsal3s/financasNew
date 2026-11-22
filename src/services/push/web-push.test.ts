import { beforeEach, describe, expect, it, vi } from "vitest";
import * as platformModule from "@/services/native/platform";
import {
  extractWebPushKeys,
  getCurrentWebPushSubscription,
  isWebPushSupported,
  subscribeBrowserWebPush,
  unsubscribeBrowserWebPush,
  urlBase64ToUint8Array,
} from "./web-push";

describe("web-push service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
  });

  it("converte VAPID base64url em Uint8Array corretamente", () => {
    const arr = urlBase64ToUint8Array("SGVsbG8td29ybGRfMTIz");
    expect(arr).toBeInstanceOf(Uint8Array);
    expect(arr.byteLength).toBeGreaterThan(0);
    expect(arr.buffer).toBeInstanceOf(ArrayBuffer);
  });

  it("extrai chaves de PushSubscription via toJSON e via getKey fallback", () => {
    const fromJson = extractWebPushKeys({
      endpoint: "https://push.example/1",
      toJSON: () => ({ keys: { p256dh: "k1", auth: "a1" } }),
    } as unknown as PushSubscription);
    expect(fromJson).toEqual({ endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" });

    const buf = new Uint8Array([1, 2, 3]).buffer;
    const fromGetKey = extractWebPushKeys({
      endpoint: "https://push.example/2",
      toJSON: () => ({}),
      getKey: () => buf,
    } as unknown as PushSubscription);
    expect(fromGetKey).toEqual({ endpoint: "https://push.example/2", p256dh: "AQID", auth: "AQID" });
  });

  it("retorna unsupported quando executando em plataforma nativa Android", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    expect(isWebPushSupported()).toBe(false);
    const res = await subscribeBrowserWebPush("VAPID_KEY");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("unsupported");
    }
  });

  it("retorna missing_vapid_key quando a chave VAPID estiver ausente", async () => {
    Object.defineProperty(window, "PushManager", { value: vi.fn(), configurable: true });
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission: vi.fn() },
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistration: vi.fn() },
      configurable: true,
    });

    const res = await subscribeBrowserWebPush("");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("missing_vapid_key");
    }
  });

  it("inscreve, lê e cancela inscrição Web Push via PushManager", async () => {
    const unsubscribeMock = vi.fn().mockResolvedValue(true);
    const fakeSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      toJSON: () => ({ keys: { p256dh: "pub123", auth: "auth456" } }),
      unsubscribe: unsubscribeMock,
    } as unknown as PushSubscription;

    const getSubscriptionMock = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fakeSub)
      .mockResolvedValueOnce(fakeSub);
    const subscribeMock = vi.fn().mockResolvedValue(fakeSub);

    Object.defineProperty(window, "PushManager", { value: vi.fn(), configurable: true });
    Object.defineProperty(window, "Notification", {
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: {
            getSubscription: getSubscriptionMock,
            subscribe: subscribeMock,
          },
        }),
        ready: Promise.resolve(undefined),
      },
      configurable: true,
    });

    const subResult = await subscribeBrowserWebPush("SGVsbG8td29ybGRfMTIz");
    expect(subResult).toEqual({
      ok: true,
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        p256dh: "pub123",
        auth: "auth456",
      },
    });
    expect(subscribeMock).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });

    const current = await getCurrentWebPushSubscription();
    expect(current?.endpoint).toBe("https://fcm.googleapis.com/fcm/send/abc");

    const unsubResult = await unsubscribeBrowserWebPush();
    expect(unsubResult).toEqual({
      unsubscribed: true,
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    });
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
