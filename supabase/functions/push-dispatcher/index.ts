import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildCorsHeaders,
  jsonResponse,
  safeErrorResponse,
  timingSafeEqualString,
} from "../_shared/http.ts";

type PushSeverity = "P0" | "P1" | "P2" | "P3";

interface PushDispatcherPayload {
  eventType?: string;
  targetUserIds?: string[];
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  severity?: PushSeverity;
  idempotencyKey?: string;
  respectQuietHours?: boolean;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  platform: "web_push" | "fcm";
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  fcm_token: string | null;
}

interface QuietHoursSetting {
  enabled?: boolean;
  start?: string;
  end?: string;
}

interface UserPrefDeviceSettings {
  remotePushEnabled?: boolean;
  quietHours?: QuietHoursSetting;
}

interface UserPrefDividendAutomation {
  notifyOnProvisioned?: boolean;
  notifyOnPayment?: boolean;
}

interface WebPushClient {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ): Promise<unknown>;
}

interface FcmServiceAccount {
  client_email: string;
  private_key: string;
}

function sanitizeRelativeAppUrl(raw: string | undefined): string {
  const candidate = (raw || "").trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }
  return "/lembretes";
}

function parseHHMM(raw: string | undefined, fallbackH: number, fallbackM: number): number {
  if (!raw) return fallbackH * 60 + fallbackM;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return fallbackH * 60 + fallbackM;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return fallbackH * 60 + fallbackM;
  }
  return h * 60 + min;
}

function getCurrentMinutesInTimeZone(timeZone = "America/Sao_Paulo"): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "12") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (Number.isNaN(h) ? 12 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

function isQuietHoursActive(setting?: QuietHoursSetting | null): boolean {
  if (setting?.enabled === false) return false;
  const startMins = parseHHMM(setting?.start, 22, 0);
  const endMins = parseHHMM(setting?.end, 8, 0);
  if (startMins === endMins) return false;
  const currentMins = getCurrentMinutesInTimeZone("America/Sao_Paulo");
  if (startMins < endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  return currentMins >= startMins || currentMins < endMins;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

async function getFcmAccessToken(serviceAccount: FcmServiceAccount): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSec + 3600,
      iat: nowSec,
    }),
  );

  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(sigBuf))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`FCM OAuth token exchange failed (${tokenRes.status})`);
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("FCM OAuth access_token missing");
  }
  return tokenData.access_token;
}

async function loadWebPushClient(
  vapidSubject: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
): Promise<WebPushClient> {
  const mod = (await import("npm:web-push@3.6.7")) as { default?: WebPushClient } & WebPushClient;
  const client = mod.default ?? mod;
  client.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  return client;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método não permitido" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return safeErrorResponse(req, 500, "Configuração do servidor de banco incompleta.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const payload: PushDispatcherPayload = await req.json().catch(() => ({}));

    const eventType = (payload.eventType || "general").trim();
    const title = (payload.title || "").trim();
    const body = (payload.body || "").trim();
    const url = sanitizeRelativeAppUrl(payload.url);
    const tag = payload.tag?.trim() || undefined;
    const severity: PushSeverity = payload.severity ?? "P2";
    const respectQuietHours = payload.respectQuietHours ?? true;

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const headerWebhookSecret = req.headers.get("x-webhook-secret") ?? "";

    const isServiceCaller =
      (bearerToken.length > 0 && (await timingSafeEqualString(bearerToken, supabaseServiceKey))) ||
      (webhookSecret.length > 0 &&
        ((headerWebhookSecret.length > 0 &&
          (await timingSafeEqualString(headerWebhookSecret, webhookSecret))) ||
          (bearerToken.length > 0 && (await timingSafeEqualString(bearerToken, webhookSecret))))) ||
      (cronSecret.length > 0 &&
        bearerToken.length > 0 &&
        (await timingSafeEqualString(bearerToken, cronSecret)));

    let targetUserIds = Array.isArray(payload.targetUserIds)
      ? Array.from(new Set(payload.targetUserIds.filter((id) => typeof id === "string" && id.trim().length > 0)))
      : [];

    if (!isServiceCaller) {
      if (!authHeader || !anonKey) {
        return jsonResponse(req, { error: "Sessão não informada" }, 401);
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser();

      if (authError || !user) {
        return jsonResponse(req, { error: "Sessão inválida ou expirada" }, 401);
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.status !== "active") {
        return jsonResponse(req, { error: "Conta inativa ou não autorizada" }, 403);
      }

      const isAdmin = ["admin", "superadmin"].includes(String(profile.role));
      if (!isAdmin) {
        const isSelfTest =
          eventType === "test_push" &&
          (targetUserIds.length === 0 ||
            (targetUserIds.length === 1 && targetUserIds[0] === user.id));
        if (!isSelfTest) {
          return jsonResponse(req, { error: "Acesso não autorizado ao dispatcher de push" }, 403);
        }
        targetUserIds = [user.id];
      }
    }

    if (!title || !body) {
      return jsonResponse(req, { error: "Título e corpo da notificação são obrigatórios" }, 400);
    }

    if (targetUserIds.length === 0) {
      return jsonResponse(req, { error: "Nenhum usuário de destino informado" }, 400);
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@axir.com.br";
    const hasWebPush = Boolean(vapidPublicKey && vapidPrivateKey);

    const fcmProjectId = Deno.env.get("FCM_PROJECT_ID") ?? "";
    const fcmServiceJsonRaw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "";
    let fcmServiceAccount: FcmServiceAccount | null = null;
    if (fcmProjectId && fcmServiceJsonRaw) {
      try {
        fcmServiceAccount = JSON.parse(fcmServiceJsonRaw) as FcmServiceAccount;
      } catch {
        fcmServiceAccount = null;
      }
    }
    const hasFcm = Boolean(fcmProjectId && fcmServiceAccount?.client_email && fcmServiceAccount?.private_key);

    if (!hasWebPush && !hasFcm) {
      const baseKey = payload.idempotencyKey?.trim() || `${eventType}:${Date.now()}`;
      for (const uid of targetUserIds) {
        await supabaseAdmin
          .from("push_delivery_logs")
          .upsert(
            {
              user_id: uid,
              event_type: eventType,
              idempotency_key: `${baseKey}:${uid}`,
              channel: "none",
              status: "skipped_unconfigured",
            },
            { onConflict: "idempotency_key", ignoreDuplicates: false },
          );
      }

      return jsonResponse(req, {
        success: true,
        delivered: 0,
        warning: "push_providers_not_configured",
      });
    }

    let webPushClient: WebPushClient | null = null;
    if (hasWebPush) {
      webPushClient = await loadWebPushClient(vapidSubject, vapidPublicKey, vapidPrivateKey);
    }

    let fcmAccessToken: string | null = null;
    let fcmTokenTried = false;

    const baseIdempotency = payload.idempotencyKey?.trim() || `${eventType}:${Date.now()}`;
    let delivered = 0;
    let skipped = 0;
    let failed = 0;

    for (const uid of targetUserIds) {
      const userIdempKey = `${baseIdempotency}:${uid}`;
      const { data: existingLog } = await supabaseAdmin
        .from("push_delivery_logs")
        .select("id, status")
        .eq("idempotency_key", userIdempKey)
        .in("status", ["sent", "partial"])
        .maybeSingle();

      if (existingLog) {
        skipped += 1;
        continue;
      }

      const { data: prefRow } = await supabaseAdmin
        .from("user_preferences")
        .select("custom_settings")
        .eq("user_id", uid)
        .maybeSingle();

      const customSettings = (prefRow?.custom_settings ?? {}) as {
        deviceNotifications?: UserPrefDeviceSettings;
        dividendAutomation?: UserPrefDividendAutomation;
      };
      const deviceNotifs = customSettings.deviceNotifications;
      const divAutomation = customSettings.dividendAutomation;

      const isDividendEventDisabledByUser =
        (eventType === "dividend_provisioned" && divAutomation?.notifyOnProvisioned === false) ||
        ((eventType === "dividend_settled" || eventType === "dividend_pending_confirmation") &&
          divAutomation?.notifyOnPayment === false);

      const isOptInAllowed =
        !isDividendEventDisabledByUser &&
        (eventType === "test_push" ||
          severity === "P0" ||
          deviceNotifs?.remotePushEnabled === true);

      if (!isOptInAllowed) {
        await supabaseAdmin
          .from("push_delivery_logs")
          .upsert(
            {
              user_id: uid,
              event_type: eventType,
              idempotency_key: userIdempKey,
              channel: "none",
              status: "skipped_disabled",
            },
            { onConflict: "idempotency_key" },
          );
        skipped += 1;
        continue;
      }

      const bypassQuietHours = severity === "P0" || eventType === "test_push" || !respectQuietHours;
      if (!bypassQuietHours && isQuietHoursActive(deviceNotifs?.quietHours)) {
        await supabaseAdmin
          .from("push_delivery_logs")
          .upsert(
            {
              user_id: uid,
              event_type: eventType,
              idempotency_key: userIdempKey,
              channel: "none",
              status: "skipped_quiet_hours",
            },
            { onConflict: "idempotency_key" },
          );
        skipped += 1;
        continue;
      }

      const { data: subs } = await supabaseAdmin
        .from("user_push_subscriptions")
        .select("id, user_id, platform, endpoint, p256dh, auth, fcm_token")
        .eq("user_id", uid)
        .eq("is_active", true);

      const activeSubs = (subs ?? []) as PushSubscriptionRow[];
      if (activeSubs.length === 0) {
        await supabaseAdmin
          .from("push_delivery_logs")
          .upsert(
            {
              user_id: uid,
              event_type: eventType,
              idempotency_key: userIdempKey,
              channel: "none",
              status: "skipped_no_subscription",
            },
            { onConflict: "idempotency_key" },
          );
        skipped += 1;
        continue;
      }

      const hasActiveFcmSub = activeSubs.some((s) => s.platform === "fcm" && Boolean(s.fcm_token));
      if (hasActiveFcmSub && hasFcm && fcmServiceAccount && !fcmTokenTried) {
        fcmTokenTried = true;
        try {
          fcmAccessToken = await getFcmAccessToken(fcmServiceAccount);
        } catch (fcmAuthErr) {
          console.warn("[push-dispatcher] Falha ao obter token OAuth FCM:", fcmAuthErr);
          fcmAccessToken = null;
        }
      }

      let userSuccessCount = 0;
      let userErrorCount = 0;
      let hasEligibleProvider = false;
      const usedChannels = new Set<"web_push" | "fcm">();
      let lastErrorCode = "";

      for (const sub of activeSubs) {
        if (sub.platform === "web_push" && webPushClient && sub.endpoint && sub.p256dh && sub.auth) {
          hasEligibleProvider = true;
          usedChannels.add("web_push");
          try {
            await webPushClient.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title, body, url, tag, eventType, severity }),
            );
            userSuccessCount += 1;
            await supabaseAdmin
              .from("user_push_subscriptions")
              .update({ last_used_at: new Date().toISOString() })
              .eq("id", sub.id);
          } catch (err) {
            userErrorCount += 1;
            const statusCode =
              typeof err === "object" && err !== null && "statusCode" in err
                ? Number((err as { statusCode?: number }).statusCode)
                : 0;
            lastErrorCode = statusCode > 0 ? `web_push_http_${statusCode}` : "web_push_error";
            if (statusCode === 404 || statusCode === 410) {
              await supabaseAdmin
                .from("user_push_subscriptions")
                .update({ is_active: false })
                .eq("id", sub.id);
            }
          }
        } else if (sub.platform === "fcm" && hasFcm && fcmAccessToken && sub.fcm_token) {
          hasEligibleProvider = true;
          usedChannels.add("fcm");
          try {
            const fcmRes = await fetch(
              `https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${fcmAccessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  message: {
                    token: sub.fcm_token,
                    notification: { title, body },
                    android: {
                      notification: {
                        channel_id: "due_reminders",
                        tag: tag ?? eventType,
                      },
                    },
                    data: {
                      url,
                      eventType,
                      tag: tag ?? "",
                      severity,
                    },
                  },
                }),
              },
            );

            if (fcmRes.ok) {
              userSuccessCount += 1;
              await supabaseAdmin
                .from("user_push_subscriptions")
                .update({ last_used_at: new Date().toISOString() })
                .eq("id", sub.id);
            } else {
              const errText = await fcmRes.text().catch(() => "");
              userErrorCount += 1;
              lastErrorCode = `fcm_http_${fcmRes.status}`;
              const isPermanentTokenFailure =
                fcmRes.status === 404 ||
                errText.includes("UNREGISTERED") ||
                errText.includes("NOT_FOUND") ||
                errText.includes("SENDER_ID_MISMATCH") ||
                (fcmRes.status === 400 && errText.includes("INVALID_ARGUMENT"));
              if (isPermanentTokenFailure) {
                await supabaseAdmin
                  .from("user_push_subscriptions")
                  .update({ is_active: false })
                  .eq("id", sub.id);
              }
            }
          } catch {
            userErrorCount += 1;
            lastErrorCode = "fcm_network_error";
          }
        }
      }

      if (!hasEligibleProvider) {
        await supabaseAdmin
          .from("push_delivery_logs")
          .upsert(
            {
              user_id: uid,
              event_type: eventType,
              idempotency_key: userIdempKey,
              channel: "none",
              status: "skipped_unconfigured",
              error_detail: "provider_unconfigured_for_subscription",
            },
            { onConflict: "idempotency_key" },
          );
        skipped += 1;
        continue;
      }

      const channel =
        usedChannels.size > 1
          ? "mixed"
          : usedChannels.has("web_push")
            ? "web_push"
            : usedChannels.has("fcm")
              ? "fcm"
              : "none";

      const logStatus =
        userSuccessCount > 0 && userErrorCount === 0
          ? "sent"
          : userSuccessCount > 0
            ? "partial"
            : "failed";

      await supabaseAdmin
        .from("push_delivery_logs")
        .upsert(
          {
            user_id: uid,
            event_type: eventType,
            idempotency_key: userIdempKey,
            channel,
            status: logStatus,
            error_detail: lastErrorCode || null,
          },
          { onConflict: "idempotency_key" },
        );

      if (userSuccessCount > 0) delivered += 1;
      else failed += 1;
    }

    return jsonResponse(req, {
      success: true,
      delivered,
      skipped,
      failed,
    });
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro interno ao despachar notificação push.", err);
  }
});
