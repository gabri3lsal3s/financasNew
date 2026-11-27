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
  targetInstallationId?: string;
  expectedRecipientVersion?: number;
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
  installation_id: string | null;
  recipient_version: number;
  multi_account_opt_in: boolean;
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

const NEUTRAL_PUSH_TITLE = "Axir";
const NEUTRAL_PUSH_BODY = "Você tem uma nova atualização na sua Central de Notificações.";

const SENSITIVE_PUSH_PATTERNS = [
  /R\$\s*[\d.,]+/i,
  /\$\s*[\d.,]+/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/,
];

function sanitizeNeutralPushText(raw: string | undefined, fallback: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return fallback;
  for (const pattern of SENSITIVE_PUSH_PATTERNS) {
    if (pattern.test(trimmed)) {
      return fallback;
    }
  }
  return trimmed;
}

function sanitizeRelativeAppUrl(raw: string | undefined): string {
  const candidate = (raw || "").trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    try {
      const parsed = new URL(candidate, "https://axir.local");
      parsed.searchParams.delete("account");
      parsed.searchParams.delete("switchAccount");
      parsed.searchParams.delete("user_id");
      parsed.searchParams.delete("userId");
      parsed.searchParams.delete("token");
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return "/lembretes";
    }
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

const OUTBOUND_TIMEOUT_MS = 5000;

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = OUTBOUND_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timerId);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = OUTBOUND_TIMEOUT_MS,
  timeoutMessage = "Operation timed out",
): Promise<T> {
  // Evita unhandledrejection caso o timeout vença e a promise original rejeite depois
  promise.catch(() => {});
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
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

  const tokenRes = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    await tokenRes.body?.cancel().catch(() => {});
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
    const rawTitle = (payload.title || "").trim();
    const rawBody = (payload.body || "").trim();
    if (!rawTitle || !rawBody) {
      return jsonResponse(req, { error: "Título e corpo da notificação são obrigatórios" }, 400);
    }
    const title = sanitizeNeutralPushText(rawTitle, NEUTRAL_PUSH_TITLE);
    const body = sanitizeNeutralPushText(rawBody, NEUTRAL_PUSH_BODY);
    const targetInstallationId = payload.targetInstallationId?.trim() || null;
    const expectedRecipientVersion =
      typeof payload.expectedRecipientVersion === "number" &&
      Number.isInteger(payload.expectedRecipientVersion) &&
      payload.expectedRecipientVersion >= 1
        ? payload.expectedRecipientVersion
        : null;
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

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("[push-dispatcher] Erro ao consultar perfil do chamador:", profileError);
        return safeErrorResponse(req, 500, "Erro ao validar perfil do usuário.", profileError);
      }

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

    let webPushClient: WebPushClient | null = null;
    if (hasWebPush) {
      try {
        webPushClient = await loadWebPushClient(vapidSubject, vapidPublicKey, vapidPrivateKey);
      } catch (vapidErr) {
        console.warn("[push-dispatcher] Falha ao inicializar web-push (VAPID):", vapidErr);
        webPushClient = null;
      }
    }

    const baseIdempotency = payload.idempotencyKey?.trim() || `${eventType}:${Date.now()}`;

    if (!webPushClient && !hasFcm) {
      for (const uid of targetUserIds) {
        const { error: skipLogErr } = await supabaseAdmin
          .from("push_delivery_logs")
          .upsert(
            {
              user_id: uid,
              event_type: eventType,
              idempotency_key: `${baseIdempotency}:${uid}`,
              channel: "none",
              status: "skipped_unconfigured",
            },
            { onConflict: "idempotency_key", ignoreDuplicates: true },
          );
        if (skipLogErr) {
          console.warn("[push-dispatcher] Erro ao gravar log skipped_unconfigured:", skipLogErr);
        }
      }

      return jsonResponse(req, {
        success: true,
        delivered: 0,
        warning: "push_providers_not_configured",
      });
    }

    let fcmAccessToken: string | null = null;
    let fcmTokenTried = false;

    let delivered = 0;
    let skipped = 0;
    let failed = 0;

    const finalizeDeliveryLog = async (
      uid: string,
      userIdempKey: string,
      channel: "web_push" | "fcm" | "mixed" | "none",
      status:
        | "sent"
        | "partial"
        | "skipped_quiet_hours"
        | "skipped_disabled"
        | "skipped_no_subscription"
        | "skipped_unconfigured"
        | "failed",
      errorDetail: string | null = null,
    ) => {
      const { error: logErr } = await supabaseAdmin
        .from("push_delivery_logs")
        .update({
          channel,
          status,
          error_detail: errorDetail,
        })
        .eq("idempotency_key", userIdempKey)
        .eq("user_id", uid);
      if (logErr) {
        console.error("[push-dispatcher] Erro ao atualizar push_delivery_logs:", logErr);
      }
    };

    for (const uid of targetUserIds) {
      const userIdempKey = `${baseIdempotency}:${uid}`;

      // Reserva atomica insert-first para eliminar janela TOCTOU de disparos concorrentes
      const { error: reserveError } = await supabaseAdmin
        .from("push_delivery_logs")
        .insert({
          user_id: uid,
          event_type: eventType,
          idempotency_key: userIdempKey,
          channel: "none",
          status: "failed",
          error_detail: "in_flight",
        });

      if (reserveError) {
        if (reserveError.code === "23505") {
          const { data: existingLog, error: existingErr } = await supabaseAdmin
            .from("push_delivery_logs")
            .select("id, status, error_detail, created_at")
            .eq("idempotency_key", userIdempKey)
            .maybeSingle();

          if (existingErr) {
            console.error("[push-dispatcher] Erro ao consultar lock de idempotência:", existingErr);
            failed += 1;
            continue;
          }

          if (!existingLog || existingLog.status === "sent" || existingLog.status === "partial") {
            skipped += 1;
            continue;
          }

          const createdMs = Date.parse(String(existingLog.created_at ?? ""));
          const isActiveInFlight =
            existingLog.error_detail === "in_flight" &&
            Number.isFinite(createdMs) &&
            Date.now() - createdMs < 120_000;

          if (isActiveInFlight) {
            skipped += 1;
            continue;
          }

          const { data: claimedLog, error: claimErr } = await supabaseAdmin
            .from("push_delivery_logs")
            .update({
              channel: "none",
              status: "failed",
              error_detail: "in_flight",
              created_at: new Date().toISOString(),
            })
            .eq("id", existingLog.id)
            .eq("status", existingLog.status)
            .eq("created_at", existingLog.created_at)
            .select("id")
            .maybeSingle();

          if (claimErr) {
            console.error("[push-dispatcher] Erro ao reivindicar lock de idempotência:", claimErr);
            failed += 1;
            continue;
          }

          if (!claimedLog) {
            skipped += 1;
            continue;
          }
        } else {
          console.error("[push-dispatcher] Erro ao reservar idempotência em push_delivery_logs:", reserveError);
          failed += 1;
          continue;
        }
      }

      const { data: prefRow, error: prefError } = await supabaseAdmin
        .from("user_preferences")
        .select("custom_settings")
        .eq("user_id", uid)
        .maybeSingle();

      if (prefError) {
        console.warn("[push-dispatcher] Erro ao carregar user_preferences:", prefError);
      }

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
        await finalizeDeliveryLog(uid, userIdempKey, "none", "skipped_disabled");
        skipped += 1;
        continue;
      }

      const bypassQuietHours = severity === "P0" || eventType === "test_push" || !respectQuietHours;
      if (!bypassQuietHours && isQuietHoursActive(deviceNotifs?.quietHours)) {
        await finalizeDeliveryLog(uid, userIdempKey, "none", "skipped_quiet_hours");
        skipped += 1;
        continue;
      }

      const { data: subs, error: subsError } = await supabaseAdmin
        .from("user_push_subscriptions")
        .select("id, user_id, platform, endpoint, p256dh, auth, fcm_token, installation_id, recipient_version, multi_account_opt_in")
        .eq("user_id", uid)
        .eq("is_active", true);

      if (subsError) {
        console.error("[push-dispatcher] Erro ao consultar user_push_subscriptions:", subsError);
        await finalizeDeliveryLog(uid, userIdempKey, "none", "failed", "subs_query_error");
        failed += 1;
        continue;
      }

      const rawSubs = (subs ?? []) as PushSubscriptionRow[];
      const activeSubs = rawSubs.filter((sub) => {
        if (sub.user_id !== uid) return false;
        if (!Number.isInteger(sub.recipient_version) || sub.recipient_version < 1) return false;
        if (targetInstallationId && sub.installation_id !== targetInstallationId) return false;
        if (expectedRecipientVersion !== null && sub.recipient_version !== expectedRecipientVersion) return false;
        return true;
      });
      if (activeSubs.length === 0) {
        await finalizeDeliveryLog(uid, userIdempKey, "none", "skipped_no_subscription");
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
            await withTimeout(
              webPushClient.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({
                  title,
                  body,
                  url,
                  tag,
                  eventType,
                  severity,
                  installationId: sub.installation_id ?? undefined,
                  recipientVersion: sub.recipient_version,
                  recipientUserId: uid,
                }),
              ),
              OUTBOUND_TIMEOUT_MS,
              "web_push_timeout",
            );
            userSuccessCount += 1;
            const { error: touchErr } = await supabaseAdmin
              .from("user_push_subscriptions")
              .update({ last_used_at: new Date().toISOString() })
              .eq("id", sub.id);
            if (touchErr) {
              console.warn("[push-dispatcher] Erro ao atualizar last_used_at web_push:", touchErr);
            }
          } catch (err) {
            userErrorCount += 1;
            const statusCode =
              typeof err === "object" && err !== null && "statusCode" in err
                ? Number((err as { statusCode?: number }).statusCode)
                : 0;
            const isTimeout = err instanceof Error && err.message === "web_push_timeout";
            lastErrorCode =
              statusCode > 0
                ? `web_push_http_${statusCode}`
                : isTimeout
                  ? "web_push_timeout"
                  : "web_push_error";
            if (statusCode === 404 || statusCode === 410) {
              const { error: deactErr } = await supabaseAdmin
                .from("user_push_subscriptions")
                .update({ is_active: false })
                .eq("id", sub.id);
              if (deactErr) {
                console.warn("[push-dispatcher] Erro ao desativar assinatura web_push:", deactErr);
              }
            }
          }
        } else if (sub.platform === "fcm" && hasFcm && fcmAccessToken && sub.fcm_token) {
          hasEligibleProvider = true;
          usedChannels.add("fcm");
          try {
            const fcmRes = await fetchWithTimeout(
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
                      installationId: sub.installation_id ?? "",
                      recipientVersion: String(sub.recipient_version),
                      recipientUserId: uid,
                    },
                  },
                }),
              },
              OUTBOUND_TIMEOUT_MS,
            );

            if (fcmRes.ok) {
              await fcmRes.body?.cancel().catch(() => {});
              userSuccessCount += 1;
              const { error: touchErr } = await supabaseAdmin
                .from("user_push_subscriptions")
                .update({ last_used_at: new Date().toISOString() })
                .eq("id", sub.id);
              if (touchErr) {
                console.warn("[push-dispatcher] Erro ao atualizar last_used_at fcm:", touchErr);
              }
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
                const { error: deactErr } = await supabaseAdmin
                  .from("user_push_subscriptions")
                  .update({ is_active: false })
                  .eq("id", sub.id);
                if (deactErr) {
                  console.warn("[push-dispatcher] Erro ao desativar assinatura fcm:", deactErr);
                }
              }
            }
          } catch (fcmErr) {
            userErrorCount += 1;
            lastErrorCode =
              fcmErr instanceof Error && fcmErr.name === "AbortError"
                ? "fcm_timeout"
                : "fcm_network_error";
          }
        }
      }

      if (!hasEligibleProvider) {
        await finalizeDeliveryLog(
          uid,
          userIdempKey,
          "none",
          "skipped_unconfigured",
          "provider_unconfigured_for_subscription",
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

      await finalizeDeliveryLog(uid, userIdempKey, channel, logStatus, lastErrorCode || null);

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
