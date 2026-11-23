import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deactivateAllMyPushSubscriptions,
  deactivatePushSubscriptionByEndpoint,
  deactivatePushSubscriptionByFcmToken,
  listMyPushSubscriptions,
  upsertFcmPushSubscription,
  upsertWebPushSubscription,
} from "./push-subscriptions";

const mockSingle = vi.fn();
const mockSelectAfterUpsert = vi.fn(() => ({ single: mockSingle }));
const mockUpsert = vi.fn(() => ({ select: mockSelectAfterUpsert }));

const mockOrder = vi.fn();
const mockEqSelect = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));

const mockEqUpdateSecond = vi.fn();
const mockEqUpdateFirst = vi.fn(() => ({ eq: mockEqUpdateSecond }));
const mockUpdate = vi.fn(() => ({ eq: mockEqUpdateFirst }));

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
  update: mockUpdate,
}));

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-1"),
}));

describe("push-subscriptions repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista assinaturas de push ordenadas por updated_at desc", async () => {
    const rows = [{ id: "s1", user_id: "user-1", platform: "web_push", is_active: true }];
    mockOrder.mockResolvedValueOnce({ data: rows, error: null });

    const res = await listMyPushSubscriptions();
    expect(mockFrom).toHaveBeenCalledWith("user_push_subscriptions");
    expect(mockEqSelect).toHaveBeenCalledWith("user_id", "user-1");
    expect(res).toEqual(rows);
  });

  it("salva assinatura Web Push com onConflict user_id,endpoint", async () => {
    const saved = {
      id: "s1",
      user_id: "user-1",
      platform: "web_push",
      endpoint: "https://push.example/1",
      is_active: true,
    };
    mockSingle.mockResolvedValueOnce({ data: saved, error: null });

    const res = await upsertWebPushSubscription({
      endpoint: "https://push.example/1",
      p256dh: "pk",
      auth: "ak",
      deviceLabel: "Chrome Linux",
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        platform: "web_push",
        endpoint: "https://push.example/1",
        p256dh: "pk",
        auth: "ak",
        fcm_token: null,
        is_active: true,
      }),
      { onConflict: "user_id,endpoint" },
    );
    expect(res).toEqual(saved);
  });

  it("salva token FCM com onConflict user_id,fcm_token", async () => {
    const saved = { id: "s2", user_id: "user-1", platform: "fcm", fcm_token: "tok-123" };
    mockSingle.mockResolvedValueOnce({ data: saved, error: null });

    const res = await upsertFcmPushSubscription({ fcmToken: "tok-123" });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        platform: "fcm",
        fcm_token: "tok-123",
        endpoint: null,
      }),
      { onConflict: "user_id,fcm_token" },
    );
    expect(res).toEqual(saved);
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
