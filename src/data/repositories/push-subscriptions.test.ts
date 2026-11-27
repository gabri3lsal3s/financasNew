import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deactivateAllMyPushSubscriptions,
  deactivatePushSubscriptionByEndpoint,
  deactivatePushSubscriptionByFcmToken,
  getKnownRecipientVersion,
  getOrCreatePushInstallationId,
  listMyPushSubscriptions,
  upsertFcmPushSubscription,
  upsertWebPushSubscription,
} from "./push-subscriptions";

const mockRpc = vi.fn();
const mockOrder = vi.fn();
const mockEqSelect = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));

const mockEqUpdateSecond = vi.fn();
const mockEqUpdateFirst = vi.fn(() => ({ eq: mockEqUpdateSecond }));
const mockUpdate = vi.fn(() => ({ eq: mockEqUpdateFirst }));

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-1"),
}));

describe("push-subscriptions repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("gera e reutiliza installation_id estável localmente", () => {
    const first = getOrCreatePushInstallationId();
    const second = getOrCreatePushInstallationId();
    expect(first).toMatch(/^inst_/);
    expect(second).toBe(first);
  });

  it("lista assinaturas de push ordenadas por updated_at desc", async () => {
    const rows = [
      {
        id: "s1",
        user_id: "user-1",
        platform: "web_push",
        installation_id: "inst_12345678",
        recipient_version: 2,
        multi_account_opt_in: false,
        is_active: true,
      },
    ];
    mockOrder.mockResolvedValueOnce({ data: rows, error: null });

    const res = await listMyPushSubscriptions();
    expect(mockFrom).toHaveBeenCalledWith("user_push_subscriptions");
    expect(mockEqSelect).toHaveBeenCalledWith("user_id", "user-1");
    expect(res).toEqual(rows);
  });

  it("vincula assinatura Web Push atomicamente por instalação via RPC e persiste recipient_version", async () => {
    const saved = {
      id: "s1",
      user_id: "user-1",
      platform: "web_push",
      endpoint: "https://push.example/1",
      installation_id: "inst_web_0001",
      recipient_version: 3,
      multi_account_opt_in: false,
      is_active: true,
    };
    mockRpc.mockResolvedValueOnce({ data: saved, error: null });

    const res = await upsertWebPushSubscription({
      endpoint: "https://push.example/1",
      p256dh: "pk",
      auth: "ak",
      deviceLabel: "Chrome Linux",
      installationId: "inst_web_0001",
    });

    expect(mockRpc).toHaveBeenCalledWith("bind_push_subscription_installation", {
      p_platform: "web_push",
      p_installation_id: "inst_web_0001",
      p_endpoint: "https://push.example/1",
      p_p256dh: "pk",
      p_auth: "ak",
      p_fcm_token: null,
      p_device_label: "Chrome Linux",
      p_user_agent: expect.any(String),
      p_multi_account_opt_in: false,
    });
    expect(res).toEqual(saved);
    expect(getKnownRecipientVersion("user-1")).toBe(3);
  });

  it("vincula token FCM atomicamente por instalação com multi_account_opt_in explícito", async () => {
    const saved = {
      id: "s2",
      user_id: "user-1",
      platform: "fcm",
      fcm_token: "tok-123",
      installation_id: "inst_android_01",
      recipient_version: 2,
      multi_account_opt_in: true,
    };
    mockRpc.mockResolvedValueOnce({ data: saved, error: null });

    const res = await upsertFcmPushSubscription({
      fcmToken: "tok-123",
      installationId: "inst_android_01",
      multiAccountOptIn: true,
    });

    expect(mockRpc).toHaveBeenCalledWith("bind_push_subscription_installation", {
      p_platform: "fcm",
      p_installation_id: "inst_android_01",
      p_endpoint: null,
      p_p256dh: null,
      p_auth: null,
      p_fcm_token: "tok-123",
      p_device_label: "Android App",
      p_user_agent: expect.any(String),
      p_multi_account_opt_in: true,
    });
    expect(res).toEqual(saved);
    expect(getKnownRecipientVersion("user-1")).toBe(2);
  });

  it("desativa assinatura específica e todas as assinaturas do usuário", async () => {
    mockEqUpdateSecond
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    await deactivatePushSubscriptionByEndpoint("https://push.example/1");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
    expect(mockEqUpdateFirst).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockEqUpdateSecond).toHaveBeenCalledWith("endpoint", "https://push.example/1");

    await deactivatePushSubscriptionByFcmToken("fcm-tok-123");
    expect(mockEqUpdateSecond).toHaveBeenCalledWith("fcm_token", "fcm-tok-123");

    await deactivateAllMyPushSubscriptions();
    expect(mockEqUpdateSecond).toHaveBeenCalledWith("is_active", true);
  });
});
