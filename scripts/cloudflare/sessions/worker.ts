import { z } from "zod";
import { generateOpaqueToken, sha256Hex } from "./crypto";
import { SessionCoordinatorDO, type CoordinatorEnv } from "./coordinator-do";
import { SESSION_POLICY } from "./policies";

export { SessionCoordinatorDO };

export interface WorkerEnv extends CoordinatorEnv {
  SESSION_COORDINATOR: DurableObjectNamespace<SessionCoordinatorDO>;
  SESSION_COOKIE_NAME: string;
  ALLOWED_HOSTS: string;
  ALLOWED_ORIGINS: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ANDROID_PACKAGE_NAME?: string;
  ANDROID_SHA256_FINGERPRINT?: string;
  DEV_ORIGINAL_URL_HEADER?: string;
}

const CLOSED_SESSION_OPERATIONS = new Set([
  "bootstrap",
  "login",
  "mfa",
  "accounts",
  "switch",
  "open-tab",
  "redeem-tab",
  "logout",
  "forget",
  "logout-device",
  "revalidate",
]);

const bootstrapSchema = z
  .object({
    contextId: z.string().min(10).max(128).optional(),
  })
  .strict();

const loginSchema = z.discriminatedUnion("grant", [
  z
    .object({
      grant: z.literal("password"),
      mode: z.enum(["personal", "shared", "operator"]).default("personal"),
      email: z.string().email().max(254),
      password: z.string().min(1).max(256),
      displayName: z.string().trim().min(1).max(80).optional(),
    })
    .strict(),
  z
    .object({
      grant: z.literal("pkce-start"),
      mode: z.enum(["personal", "shared", "operator"]).default("personal"),
      redirectTo: z.string().url().max(512),
    })
    .strict(),
]);

const mfaSchema = z
  .object({
    factorId: z.string().min(1).max(128),
    code: z.string().trim().min(4).max(16),
  })
  .strict();

const switchSchema = z
  .object({
    targetAccountRef: z.string().min(4).max(128),
    expectedGeneration: z.number().int().nonnegative(),
    localLockSatisfied: z.boolean().default(false),
  })
  .strict();

const openTabSchema = z
  .object({
    targetAccountRef: z.string().min(4).max(128).optional(),
  })
  .strict();

const redeemTabSchema = z
  .object({
    intentToken: z.string().min(10).max(128),
  })
  .strict();

const logoutSchema = z
  .object({
    scope: z.enum(["tab", "device", "all-device"]).default("device"),
    remember: z.boolean().default(false),
  })
  .strict();

const forgetSchema = z
  .object({
    targetAccountRef: z.string().min(4).max(128).optional(),
  })
  .strict();

const recoverySchema = z
  .object({
    email: z.string().email().max(254),
    redirectTo: z.string().url().max(512).optional(),
  })
  .strict();

const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(["income", "expense"]),
    icon: z.string().trim().min(1).max(40).default("tag"),
    color: z.string().trim().min(1).max(32).default("#0F766E"),
  })
  .strict();

function parseCsvSet(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function securityHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function jsonResponse(body: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(securityHeaders());
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(
  code: "unauthorized" | "context_stale" | "step_up_required" | "limit_reached" | "service_unavailable" | "invalid_payload" | "invalid_origin" | "forbidden_host" | "not_found",
  status: number,
): Response {
  return jsonResponse({ error: code }, status);
}

function getCookieValue(request: Request, cookieName: string): string | null {
  const raw = request.headers.get("Cookie");
  if (!raw) return null;
  const pairs = raw.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === cookieName) {
      return pair.slice(idx + 1).trim();
    }
  }
  return null;
}

function extractRequestHost(request: Request, env: WorkerEnv): string {
  if (env.DEV_ORIGINAL_URL_HEADER === "1") {
    const testHost = request.headers.get("x-axir-test-host");
    if (testHost) {
      return testHost.split(":")[0].trim().toLowerCase();
    }
  }
  const hostHeader = request.headers.get("Host");
  const rawHost = hostHeader ?? new URL(request.url).host;
  return rawHost.split(":")[0].trim().toLowerCase();
}

function validateOrigin(request: Request, env: WorkerEnv): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  const allowed = parseCsvSet(env.ALLOWED_ORIGINS);
  return allowed.has(origin.trim().toLowerCase());
}

function parseOptionalNowHeader(request: Request, env: WorkerEnv): number | undefined {
  if (env.ENVIRONMENT !== "preview") return undefined;
  const raw = request.headers.get("x-test-now-ms");
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCoordinatorStub(env: WorkerEnv, installationId: string): DurableObjectStub<SessionCoordinatorDO> {
  const id = env.SESSION_COORDINATOR.idFromName(`${env.ENVIRONMENT}:${installationId}`);
  return env.SESSION_COORDINATOR.get(id);
}

async function revokeUpstreamTokens(
  env: WorkerEnv,
  coordinator: DurableObjectStub<SessionCoordinatorDO>,
  tokens: Array<{ accountRef: string; userId: string; accessToken: string }>,
  scope: "local" | "others" | "global",
  nowMs?: number,
): Promise<{ upstreamConfirmed: boolean; pendingRevocations: number }> {
  let upstreamConfirmed = true;
  let pendingRevocations = 0;

  for (const item of tokens) {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=${encodeURIComponent(scope)}`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${item.accessToken}`,
        },
      });
      if (!res.ok && res.status !== 401) {
        upstreamConfirmed = false;
        pendingRevocations = await coordinator.queuePendingRevocation({
          accountRef: item.accountRef,
          userId: item.userId,
          accessToken: item.accessToken,
          scope,
          nowMs,
        });
      }
    } catch {
      upstreamConfirmed = false;
      pendingRevocations = await coordinator.queuePendingRevocation({
        accountRef: item.accountRef,
        userId: item.userId,
        accessToken: item.accessToken,
        scope,
        nowMs,
      });
    }
  }

  return { upstreamConfirmed, pendingRevocations };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const host = extractRequestHost(request, env);
    const allowedHosts = parseCsvSet(env.ALLOWED_HOSTS);

    if (!allowedHosts.has(host)) {
      return errorResponse("forbidden_host", 403);
    }

    if (request.method === "GET" && url.pathname === "/api/sessions/v1/health") {
      return jsonResponse({
        ok: true,
        environment: env.ENVIRONMENT,
        host,
        platform: "cloudflare-worker",
        revalidationPollMs: SESSION_POLICY.REVALIDATION_POLL_MS,
      });
    }

    if (request.method === "GET" && url.pathname === "/api/sessions/v1/app-link-probe") {
      return jsonResponse({
        ok: true,
        environment: env.ENVIRONMENT,
        androidPackage: env.ANDROID_PACKAGE_NAME ?? "br.com.axir.app",
        appLinkHost: host,
        pkceIntentTtlMs: SESSION_POLICY.PKCE_INTENT_TTL_MS,
      });
    }

    // Handler separado para callback PKCE
    if (request.method === "GET" && url.pathname === "/api/sessions/v1/auth/callback") {
      const code = url.searchParams.get("code");
      const intentId = url.searchParams.get("intent");
      const installationId = getCookieValue(request, env.SESSION_COOKIE_NAME);
      const sourceContextId = request.headers.get("x-axir-context");

      if (!code || !intentId || !installationId) {
        return errorResponse("unauthorized", 401);
      }

      const coordinator = getCoordinatorStub(env, installationId);
      const nowMs = parseOptionalNowHeader(request, env);
      const consumed = await coordinator.consumePkceIntent({
        intentId,
        environment: env.ENVIRONMENT,
        sourceContextId,
        nowMs,
      });

      if (!consumed.ok) {
        return errorResponse("unauthorized", 401);
      }

      try {
        const tokenRes = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth_code: code,
            code_verifier: consumed.intent.code_verifier,
          }),
        });

        if (!tokenRes.ok) {
          return errorResponse("unauthorized", 401);
        }

        const tokenJson = (await tokenRes.json()) as {
          access_token: string;
          refresh_token: string;
          user: { id: string; email?: string; user_metadata?: { full_name?: string } };
        };

        const publicCtx = await coordinator.admitAuthenticatedAccount({
          userId: tokenJson.user.id,
          email: tokenJson.user.email,
          displayName: tokenJson.user.user_metadata?.full_name,
          mode: consumed.intent.mode as "personal" | "shared" | "operator",
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token,
          nowMs,
        });

        return jsonResponse(publicCtx, 200);
      } catch (err) {
        if (err instanceof Error && err.message === "limit_reached") {
          return errorResponse("limit_reached", 409);
        }
        return errorResponse("service_unavailable", 503);
      }
    }

    // Handler separado para recuperação de senha (nunca altera contexto ativo da aba)
    if (request.method === "POST" && url.pathname === "/api/sessions/v1/auth/recovery") {
      if (!validateOrigin(request, env)) {
        return errorResponse("invalid_origin", 403);
      }
      const raw = await request.json().catch(() => null);
      const parsed = recoverySchema.safeParse(raw);
      if (!parsed.success) {
        return errorResponse("invalid_payload", 400);
      }

      try {
        const upstream = await fetch(`${env.SUPABASE_URL}/auth/v1/recover`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: parsed.data.email,
            redirect_to: parsed.data.redirectTo,
          }),
        });
        if (!upstream.ok && upstream.status >= 500) {
          return errorResponse("service_unavailable", 503);
        }
        return jsonResponse({ accepted: true }, 200);
      } catch {
        return errorResponse("service_unavailable", 503);
      }
    }

    // Roteador fechado POST /api/sessions/v1/:operation
    if (request.method === "POST" && url.pathname.startsWith("/api/sessions/v1/")) {
      const operation = url.pathname.slice("/api/sessions/v1/".length);
      if (!CLOSED_SESSION_OPERATIONS.has(operation)) {
        return errorResponse("not_found", 404);
      }

      if (!validateOrigin(request, env)) {
        return errorResponse("invalid_origin", 403);
      }

      const nowMs = parseOptionalNowHeader(request, env);
      const rawBody = await request.json().catch(() => ({}));

      if (operation === "bootstrap") {
        const parsed = bootstrapSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse("invalid_payload", 400);

        const existingCookie = getCookieValue(request, env.SESSION_COOKIE_NAME);
        const installationId = existingCookie ?? generateOpaqueToken(16);
        const coordinator = getCoordinatorStub(env, installationId);
        const contextId = parsed.data.contextId ?? request.headers.get("x-axir-context");

        const result = await coordinator.bootstrap(contextId, env.ENVIRONMENT, nowMs);
        const extraHeaders: HeadersInit | undefined = existingCookie
          ? undefined
          : { "Set-Cookie": `${env.SESSION_COOKIE_NAME}=${installationId}; HttpOnly; Secure; Path=/; SameSite=Lax` };

        return jsonResponse(result, 200, extraHeaders);
      }

      if (operation === "login") {
        const parsed = loginSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse("invalid_payload", 400);

        const existingCookie = getCookieValue(request, env.SESSION_COOKIE_NAME);
        const installationId = existingCookie ?? generateOpaqueToken(16);
        const coordinator = getCoordinatorStub(env, installationId);
        const setCookieHeaders: HeadersInit | undefined = existingCookie
          ? undefined
          : { "Set-Cookie": `${env.SESSION_COOKIE_NAME}=${installationId}; HttpOnly; Secure; Path=/; SameSite=Lax` };

        if (parsed.data.grant === "pkce-start") {
          const codeVerifier = generateOpaqueToken(32);
          const codeChallenge = await sha256Hex(codeVerifier);
          const origin = request.headers.get("Origin") ?? "";
          const { intentId, expiresAt } = await coordinator.createPkceIntent({
            purpose: "login",
            mode: parsed.data.mode,
            environment: env.ENVIRONMENT,
            origin,
            codeVerifier,
            sourceContextId: request.headers.get("x-axir-context"),
            nowMs,
          });
          const authorizeUrl = `${env.SUPABASE_URL}/auth/v1/authorize?provider=email&code_challenge=${codeChallenge}&state=${intentId}`;
          return jsonResponse({ intentId, authorizeUrl, expiresAt }, 200, setCookieHeaders);
        }

        try {
          const upstream = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers: {
              apikey: env.SUPABASE_ANON_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: parsed.data.email,
              password: parsed.data.password,
            }),
          });

          if (!upstream.ok) {
            if (upstream.status >= 500) return errorResponse("service_unavailable", 503);
            return errorResponse("unauthorized", 401);
          }

          const tokenJson = (await upstream.json()) as {
            access_token: string;
            refresh_token: string;
            aal?: string;
            user: {
              id: string;
              email?: string;
              factors?: Array<{ id: string; status: string }>;
            };
          };

          const verifiedFactor = tokenJson.user.factors?.find((f) => f.status === "verified");
          const mfaRequired = Boolean(verifiedFactor) && tokenJson.aal !== "aal2";

          const publicCtx = await coordinator.admitAuthenticatedAccount({
            userId: tokenJson.user.id,
            email: tokenJson.user.email,
            displayName: parsed.data.displayName,
            mode: parsed.data.mode,
            accessToken: tokenJson.access_token,
            refreshToken: tokenJson.refresh_token,
            mfaVerified: !mfaRequired,
            mfaFactorId: verifiedFactor?.id ?? null,
            nowMs,
          });

          return jsonResponse(publicCtx, 200, setCookieHeaders);
        } catch (err) {
          if (err instanceof Error && err.message === "limit_reached") {
            return errorResponse("limit_reached", 409);
          }
          return errorResponse("service_unavailable", 503);
        }
      }

      // Demais operações exigem cookie de instalação e contexto
      const installationId = getCookieValue(request, env.SESSION_COOKIE_NAME);
      const contextId = request.headers.get("x-axir-context");
      const csrfToken = request.headers.get("x-axir-csrf");

      if (operation === "redeem-tab") {
        if (!installationId) return errorResponse("unauthorized", 401);
        const parsed = redeemTabSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse("invalid_payload", 400);

        const coordinator = getCoordinatorStub(env, installationId);
        const redeemed = await coordinator.redeemOpenTabIntent({
          intentToken: parsed.data.intentToken,
          environment: env.ENVIRONMENT,
          nowMs,
        });
        if (!redeemed.ok) {
          return errorResponse(redeemed.code, redeemed.code === "context_stale" ? 409 : 401);
        }
        return jsonResponse(redeemed.context, 200);
      }

      if (!installationId || !contextId) {
        return errorResponse("unauthorized", 401);
      }

      const coordinator = getCoordinatorStub(env, installationId);

      if (operation === "revalidate") {
        const result = await coordinator.revalidate(contextId, env.ENVIRONMENT, nowMs);
        return jsonResponse(result, result.status === "active" ? 200 : 401);
      }

      if (!csrfToken) {
        return errorResponse("unauthorized", 401);
      }

      if (operation === "accounts") {
        const resolved = await coordinator.resolveContext({
          contextId,
          environment: env.ENVIRONMENT,
          csrfToken,
          requireCsrf: true,
          nowMs,
        });
        if (!resolved.ok) {
          return errorResponse(resolved.code, resolved.code === "context_stale" ? 409 : 401);
        }
        const accounts = await coordinator.listAccounts(nowMs);
        return jsonResponse({ accounts }, 200);
      }

      if (operation === "mfa") {
        const parsed = mfaSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse("invalid_payload", 400);

        const resCtx = await coordinator.bootstrap(contextId, env.ENVIRONMENT, nowMs);
        if (resCtx.status !== "mfa_required") {
          return errorResponse("unauthorized", 401);
        }

        // Em T03 validamos desafio TOTP no endpoint de verificação MFA do Supabase
        const verifyRes = await fetch(`${env.SUPABASE_URL}/auth/v1/factors/${parsed.data.factorId}/verify`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: parsed.data.code }),
        }).catch(() => null);

        if (!verifyRes || !verifyRes.ok) {
          return errorResponse("unauthorized", 401);
        }

        const verifiedJson = (await verifyRes.json()) as { access_token: string; refresh_token: string };
        const completed = await coordinator.completeMfaChallenge({
          contextId,
          csrfToken,
          environment: env.ENVIRONMENT,
          accessToken: verifiedJson.access_token,
          refreshToken: verifiedJson.refresh_token,
          nowMs,
        });
        if (!completed.ok) {
          return errorResponse(completed.code, completed.code === "context_stale" ? 409 : 401);
        }
        return jsonResponse(completed.context, 200);
      }

      if (operation === "switch") {
        const parsed = switchSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse("invalid_payload", 400);

        const switched = await coordinator.switchAccount({
          currentContextId: contextId,
          csrfToken,
          targetAccountRef: parsed.data.targetAccountRef,
          expectedGeneration: parsed.data.expectedGeneration,
          localLockSatisfied: parsed.data.localLockSatisfied,
          environment: env.ENVIRONMENT,
          nowMs,
        });

        if (!switched.ok) {
          const status = switched.code === "context_stale" ? 409 : switched.code === "step_up_required" ? 403 : 401;
          return errorResponse(switched.code, status);
        }
        return jsonResponse(switched.context, 200);
      }

      if (operation === "open-tab") {
        const parsed = openTabSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse("invalid_payload", 400);

        const created = await coordinator.createOpenTabIntent({
          contextId,
          csrfToken,
          targetAccountRef: parsed.data.targetAccountRef,
          environment: env.ENVIRONMENT,
          nowMs,
        });
        if (!created.ok) {
          return errorResponse(created.code, created.code === "context_stale" ? 409 : 401);
        }
        return jsonResponse({ intentToken: created.intentToken, expiresAt: created.expiresAt }, 200);
      }

      if (operation === "logout" || operation === "logout-device") {
        const parsed = logoutSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse("invalid_payload", 400);

        const scope = operation === "logout-device" ? "all-device" : parsed.data.scope;
        const result = await coordinator.logoutContext({
          contextId,
          csrfToken,
          environment: env.ENVIRONMENT,
          scope,
          remember: parsed.data.remember,
          nowMs,
        });
        if (!result.ok) {
          return errorResponse(result.code, result.code === "context_stale" ? 409 : 401);
        }

        const remote = await revokeUpstreamTokens(env, coordinator, result.tokensToRevoke, "local", nowMs);
        return jsonResponse({
          status: "neutral",
          upstreamConfirmed: remote.upstreamConfirmed,
          pendingRevocations: remote.pendingRevocations,
        });
      }

      if (operation === "forget") {
        const parsed = forgetSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse("invalid_payload", 400);

        const forgotten = await coordinator.forgetAccount({
          contextId,
          csrfToken,
          targetAccountRef: parsed.data.targetAccountRef,
          environment: env.ENVIRONMENT,
        });
        if (!forgotten) {
          return errorResponse("unauthorized", 401);
        }
        return jsonResponse({ forgotten: true, status: "neutral" }, 200);
      }
    }

    // Proxy autenticado de dados (T02)
    if (
      request.method === "POST" &&
      (url.pathname === "/api/data/v1/categories.list" || url.pathname === "/api/data/v1/categories.create")
    ) {
      if (!validateOrigin(request, env)) {
        return errorResponse("invalid_origin", 403);
      }

      const installationId = getCookieValue(request, env.SESSION_COOKIE_NAME);
      const contextId = request.headers.get("x-axir-context");
      const csrfToken = request.headers.get("x-axir-csrf");
      if (!installationId || !contextId || !csrfToken) {
        return errorResponse("unauthorized", 401);
      }

      const coordinator = getCoordinatorStub(env, installationId);
      const resolved = await coordinator.resolveContext({
        contextId,
        environment: env.ENVIRONMENT,
        csrfToken,
        requireCsrf: true,
        nowMs: parseOptionalNowHeader(request, env),
      });

      if (!resolved.ok) {
        const status = resolved.code === "context_stale" ? 409 : resolved.code === "step_up_required" ? 403 : 401;
        return errorResponse(resolved.code, status);
      }

      if (url.pathname === "/api/data/v1/categories.list") {
        const upstream = await fetch(
          `${env.SUPABASE_URL}/rest/v1/categories?select=id,name,type,icon,color&order=name.asc`,
          {
            method: "GET",
            headers: {
              apikey: env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${resolved.accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (!upstream.ok) {
          return jsonResponse({ error: "upstream_error", status: upstream.status }, upstream.status);
        }

        const rows = await upstream.json();
        return jsonResponse({
          accountRef: resolved.accountRef,
          generation: resolved.generation,
          items: rows,
        });
      }

      const rawBody = await request.json().catch(() => null);
      const parsed = categoryCreateSchema.safeParse(rawBody);
      if (!parsed.success) {
        return errorResponse("invalid_payload", 400);
      }

      const upstream = await fetch(`${env.SUPABASE_URL}/rest/v1/categories`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${resolved.accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: resolved.userId,
          name: parsed.data.name,
          type: parsed.data.type,
          icon: parsed.data.icon,
          color: parsed.data.color,
        }),
      });

      if (!upstream.ok) {
        return jsonResponse({ error: "upstream_error", status: upstream.status }, upstream.status);
      }

      const created = await upstream.json();
      return jsonResponse({
        accountRef: resolved.accountRef,
        generation: resolved.generation,
        item: Array.isArray(created) ? created[0] : created,
      });
    }

    return errorResponse("not_found", 404);
  },
};
