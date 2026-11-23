import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as platformModule from "@/services/native/platform";
import { setActiveUserId } from "@/services/user-storage";

const pluginState = {
  listeners: new Map<string, Array<(payload: unknown) => void>>(),
};

const checkPermissionsMock = vi.fn();
const requestPermissionsMock = vi.fn();
const createChannelMock = vi.fn();
const registerMock = vi.fn();
const unregisterMock = vi.fn();
const addListenerMock = vi.fn(
  async (eventName: string, handler: (payload: unknown) => void) => {
    const list = pluginState.listeners.get(eventName) ?? [];
    list.push(handler);
    pluginState.listeners.set(eventName, list);
    return {
      remove: vi.fn(async () => {
        const current = pluginState.listeners.get(eventName) ?? [];
        pluginState.listeners.set(
          eventName,
          current.filter((item) => item !== handler),
        );
      }),
    };
  },
);

function emitNativeEvent(eventName: string, payload: unknown) {
  for (const handler of pluginState.listeners.get(eventName) ?? []) {
    handler(payload);
  }
}

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: checkPermissionsMock,
    requestPermissions: requestPermissionsMock,
    createChannel: createChannelMock,
    register: registerMock,
    unregister: unregisterMock,
    addListener: addListenerMock,
  },
}));

import {
  checkNativePushPermission,
  getStoredFcmToken,
  initNativePushListeners,
  isNativePushSupported,
  registerNativeFcmPush,
  sanitizeNotificationRoute,
  setStoredFcmToken,
  unregisterNativeFcmPush,
} from "./fcm-push";

describe("fcm-push service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pluginState.listeners.clear();
    localStorage.clear();
    setActiveUserId("user-android-1");
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
    checkPermissionsMock.mockResolvedValue({ receive: "granted" });
    requestPermissionsMock.mockResolvedValue({ receive: "granted" });
    createChannelMock.mockResolvedValue(undefined);
    registerMock.mockResolvedValue(undefined);
    unregisterMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    setActiveUserId(null);
  });

  it("retorna unsupported fora de plataforma nativa Android/iOS", async () => {
    vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    expect(isNativePushSupported()).toBe(false);
    await expect(checkNativePushPermission()).resolves.toBe("unsupported");

    const res = await registerNativeFcmPush();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("unsupported");
    }
  });

  it("retorna permission_denied quando o usuário nega a permissão nativa", async () => {
    checkPermissionsMock.mockResolvedValueOnce({ receive: "prompt" });
    requestPermissionsMock.mockResolvedValueOnce({ receive: "denied" });

    const res = await registerNativeFcmPush();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("permission_denied");
    }
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("não solicita permissão quando requestPermission === false e ainda está pendente", async () => {
    checkPermissionsMock.mockResolvedValueOnce({ receive: "prompt" });

    const res = await registerNativeFcmPush({ requestPermission: false });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("permission_denied");
    }
    expect(requestPermissionsMock).not.toHaveBeenCalled();
  });

  it("cria canal padrão, registra FCM, persiste token e limpa listeners temporários", async () => {
    registerMock.mockImplementationOnce(async () => {
      emitNativeEvent("registration", { value: "  fcm-token-abc123  " });
    });

    const res = await registerNativeFcmPush({ userId: "user-android-1" });
    expect(res).toEqual({ ok: true, token: "fcm-token-abc123" });
    expect(createChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "due_reminders", importance: 4 }),
    );
    expect(getStoredFcmToken("user-android-1")).toBe("fcm-token-abc123");
    expect(pluginState.listeners.get("registration") ?? []).toHaveLength(0);
    expect(pluginState.listeners.get("registrationError") ?? []).toHaveLength(0);
  });

  it("retorna error em registrationError e remove listeners", async () => {
    registerMock.mockImplementationOnce(async () => {
      emitNativeEvent("registrationError", { error: "SERVICE_NOT_AVAILABLE" });
    });

    const res = await registerNativeFcmPush();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("error");
    }
    expect(pluginState.listeners.get("registration") ?? []).toHaveLength(0);
    expect(pluginState.listeners.get("registrationError") ?? []).toHaveLength(0);
  });

  it("retorna timeout se o Firebase não responder dentro do prazo configurado", async () => {
    vi.useFakeTimers();
    const resPromise = registerNativeFcmPush({ timeoutMs: 2500 });
    await vi.advanceTimersByTimeAsync(2600);
    const res = await resPromise;
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("timeout");
    }
  });

  it("remove token salvo e executa unregister no plugin durante limpeza/logout", async () => {
    setStoredFcmToken("fcm-token-logout", "user-android-1");

    const res = await unregisterNativeFcmPush("user-android-1");
    expect(res).toEqual({ unregistered: true, token: "fcm-token-logout" });
    expect(unregisterMock).toHaveBeenCalledTimes(1);
    expect(getStoredFcmToken("user-android-1")).toBeNull();
  });

  it("sanitiza rotas externas e processa refresh, foreground e toque em notificação", async () => {
    expect(sanitizeNotificationRoute("/metas?id=1")).toBe("/metas?id=1");
    expect(sanitizeNotificationRoute("//evil.com/phish")).toBe("/lembretes");
    expect(sanitizeNotificationRoute("https://evil.com")).toBe("/lembretes");

    const onTokenRefresh = vi.fn();
    const onActionPerformed = vi.fn();
    const onForegroundPush = vi.fn();

    const cleanup = initNativePushListeners({
      onTokenRefresh,
      onActionPerformed,
      onForegroundPush,
    });

    await vi.waitFor(() => {
      expect(addListenerMock).toHaveBeenCalledTimes(3);
    });

    emitNativeEvent("registration", { value: "refreshed-fcm-token" });
    expect(onTokenRefresh).toHaveBeenCalledWith("refreshed-fcm-token");
    expect(getStoredFcmToken()).toBe("refreshed-fcm-token");

    emitNativeEvent("pushNotificationReceived", {
      title: "Aviso Pix",
      body: "Pagamento sinalizado",
      data: { url: "/transacoes?tab=splits" },
    });
    expect(onForegroundPush).toHaveBeenCalledWith({
      title: "Aviso Pix",
      body: "Pagamento sinalizado",
      url: "/transacoes?tab=splits",
    });

    emitNativeEvent("pushNotificationActionPerformed", {
      actionId: "tap",
      notification: { id: "1", data: { url: "//phishing.example" } },
    });
    expect(onActionPerformed).toHaveBeenCalledWith("/lembretes");

    await cleanup();
    expect(pluginState.listeners.get("registration") ?? []).toHaveLength(0);
    expect(
      pluginState.listeners.get("pushNotificationActionPerformed") ?? [],
    ).toHaveLength(0);
    expect(
      pluginState.listeners.get("pushNotificationReceived") ?? [],
    ).toHaveLength(0);
  });
});
