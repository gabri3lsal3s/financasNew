/**
 * Handler de Web Push importado pelo Service Worker principal do Workbox (`sw.js`).
 * Escuta eventos `push` em segundo plano e direciona cliques com segurança para a mesma origem.
 */

function parsePushPayload(event) {
  if (!event.data) {
    return {
      title: "Axir",
      body: "Você tem uma nova atualização na sua Central de Notificações.",
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
        return { title: "Axir", body: text, url: "/lembretes" };
      }
    } catch {
      // fallback abaixo
    }
  }
  return {
    title: "Axir",
    body: "Você tem uma nova atualização financeira.",
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
    return target.href;
  } catch {
    return fallback;
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Axir";
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : "Você tem uma atualização importante no aplicativo.";
  const targetUrl = resolveSameOriginUrl(payload.url || (payload.data && payload.data.url), "/lembretes");
  const icon = resolveSameOriginUrl(payload.icon, "/pwa/icons/icon-192.png");
  const badge = resolveSameOriginUrl(payload.badge, "/pwa/icons/icon-192.png");
  const normalizedTag =
    typeof payload.tag === "string" && payload.tag.trim().length > 0 ? payload.tag.trim() : undefined;

  const options = {
    body,
    icon,
    badge,
    tag: normalizedTag,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: targetUrl,
      eventType: payload.eventType || (payload.data && payload.data.eventType) || "general",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveSameOriginUrl(
    event.notification.data && event.notification.data.url,
    "/lembretes",
  );

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
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
