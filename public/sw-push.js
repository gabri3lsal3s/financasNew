/**
 * Handler de Web Push importado pelo Service Worker principal do Workbox (`sw.js`).
 * Escuta eventos `push` em segundo plano, garante payload neutro (sem PII/valores),
 * valida `installationId` e `recipientVersion` e direciona cliques com segurança
 * para a mesma origem sem trocar a conta da aba em foco.
 */

const NEUTRAL_TITLE = "Axir";
const NEUTRAL_BODY = "Você tem uma nova atualização na sua Central de Notificações.";

const swPushContext = {
  installationId: null,
  activeUserId: null,
  recipientVersions: Object.create(null),
};

const SENSITIVE_TEXT_PATTERNS = [
  /R\$\s*[\d.,]+/i,
  /\$\s*[\d.,]+/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/,
];

function sanitizeNeutralText(rawText, fallback) {
  if (typeof rawText !== "string") {
    return fallback;
  }
  const trimmed = rawText.trim();
  if (!trimmed) {
    return fallback;
  }
  for (const pattern of SENSITIVE_TEXT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return fallback;
    }
  }
  return trimmed;
}

function parseRecipientVersion(rawVersion) {
  if (typeof rawVersion === "number" && Number.isInteger(rawVersion) && rawVersion >= 1) {
    return rawVersion;
  }
  if (typeof rawVersion === "string" && /^\d+$/.test(rawVersion.trim())) {
    const parsed = Number(rawVersion.trim());
    if (Number.isInteger(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return null;
}

function isPayloadAuthorizedForInstallation(payload) {
  const payloadData = payload && typeof payload.data === "object" && payload.data ? payload.data : {};
  const payloadInstallationId =
    typeof payload?.installationId === "string"
      ? payload.installationId.trim()
      : typeof payloadData.installationId === "string"
        ? payloadData.installationId.trim()
        : "";
  const payloadRecipientVersion = parseRecipientVersion(
    payload?.recipientVersion ?? payloadData.recipientVersion,
  );
  const payloadUserId =
    typeof payload?.recipientUserId === "string"
      ? payload.recipientUserId.trim()
      : typeof payloadData.recipientUserId === "string"
        ? payloadData.recipientUserId.trim()
        : "";

  if (
    swPushContext.installationId &&
    payloadInstallationId &&
    payloadInstallationId !== swPushContext.installationId
  ) {
    return false;
  }

  const versionKey = payloadUserId || payloadInstallationId || "default";
  const knownVersion = swPushContext.recipientVersions[versionKey];
  if (
    typeof knownVersion === "number" &&
    payloadRecipientVersion !== null &&
    payloadRecipientVersion < knownVersion
  ) {
    return false;
  }

  return true;
}

function parsePushPayload(event) {
  if (!event.data) {
    return {
      title: NEUTRAL_TITLE,
      body: NEUTRAL_BODY,
      url: "/lembretes",
    };
  }
  try {
    const parsed = event.data.json();
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    try {
      const text = event.data.text();
      if (text) {
        return { title: NEUTRAL_TITLE, body: text, url: "/lembretes" };
      }
    } catch {
      // fallback abaixo
    }
  }
  return {
    title: NEUTRAL_TITLE,
    body: NEUTRAL_BODY,
    url: "/lembretes",
  };
}

function resolveSameOriginUrl(rawUrl, fallbackPath = "/lembretes") {
  const origin = self.location.origin;
  const fallback = `${origin}${fallbackPath}`;
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return fallback;
  }
  try {
    const target = new URL(rawUrl, origin);
    if (target.origin !== origin) {
      return fallback;
    }
    // Remove parâmetros que possam tentar troca de conta via deep-link
    target.searchParams.delete("account");
    target.searchParams.delete("switchAccount");
    target.searchParams.delete("user_id");
    target.searchParams.delete("userId");
    target.searchParams.delete("token");
    return target.href;
  } catch {
    return fallback;
  }
}

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object" || msg.type !== "AXIR_PUSH_CONTEXT") {
    return;
  }
  if (typeof msg.installationId === "string" && msg.installationId.trim()) {
    swPushContext.installationId = msg.installationId.trim();
  }
  if (typeof msg.activeUserId === "string" || msg.activeUserId === null) {
    swPushContext.activeUserId = msg.activeUserId ? msg.activeUserId.trim() : null;
  }
  const version = parseRecipientVersion(msg.recipientVersion);
  if (version !== null) {
    const key = (typeof msg.userId === "string" && msg.userId.trim()) || swPushContext.installationId || "default";
    swPushContext.recipientVersions[key] = Math.max(swPushContext.recipientVersions[key] ?? 0, version);
  }
});

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  if (!isPayloadAuthorizedForInstallation(payload)) {
    return;
  }

  const payloadData = payload && typeof payload.data === "object" && payload.data ? payload.data : {};
  const title = sanitizeNeutralText(payload.title, NEUTRAL_TITLE);
  const body = sanitizeNeutralText(payload.body, NEUTRAL_BODY);
  const targetUrl = resolveSameOriginUrl(payload.url || payloadData.url, "/lembretes");
  const icon = resolveSameOriginUrl(payload.icon, "/pwa/icons/icon-192.png");
  const badge = resolveSameOriginUrl(payload.badge, "/pwa/icons/icon-192.png");
  const normalizedTag =
    typeof payload.tag === "string" && payload.tag.trim().length > 0 ? payload.tag.trim() : undefined;

  const installationId =
    typeof payload.installationId === "string"
      ? payload.installationId.trim()
      : typeof payloadData.installationId === "string"
        ? payloadData.installationId.trim()
        : null;
  const recipientVersion = parseRecipientVersion(payload.recipientVersion ?? payloadData.recipientVersion);
  const recipientUserId =
    typeof payload.recipientUserId === "string"
      ? payload.recipientUserId.trim()
      : typeof payloadData.recipientUserId === "string"
        ? payloadData.recipientUserId.trim()
        : null;

  const options = {
    body,
    icon,
    badge,
    tag: normalizedTag,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: targetUrl,
      eventType: payload.eventType || payloadData.eventType || "general",
      installationId,
      recipientVersion,
      recipientUserId,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notifData = event.notification.data && typeof event.notification.data === "object" ? event.notification.data : {};

  if (!isPayloadAuthorizedForInstallation(notifData)) {
    return;
  }

  const targetUrl = resolveSameOriginUrl(notifData.url, "/lembretes");
  const notifUserId = typeof notifData.recipientUserId === "string" ? notifData.recipientUserId.trim() : "";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Se a notificação pertence a outra conta que não a da sessão ativa em foco,
      // não navega nem altera o contexto da aba em foco.
      if (
        notifUserId &&
        swPushContext.activeUserId &&
        notifUserId !== swPushContext.activeUserId
      ) {
        return undefined;
      }

      for (const client of windowClients) {
        let isSameOrigin;
        try {
          isSameOrigin = new URL(client.url).origin === self.location.origin;
        } catch {
          isSameOrigin = false;
        }
        if ("focus" in client && isSameOrigin) {
          return client.focus().then((focused) => {
            if (focused && "navigate" in focused && focused.url !== targetUrl) {
              return focused.navigate(targetUrl).catch(() => focused);
            }
            return focused;
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
