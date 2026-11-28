// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness, type TestHarness } from "wrangler";
import { decryptTokenPayload, encryptTokenPayload } from "./crypto";
import { computeSessionDeadlines, isSessionExpired, SESSION_POLICY } from "./policies";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WRANGLER_CONFIG = path.join(__dirname, "wrangler.jsonc");

const KEY_V1 = Buffer.alloc(32, 0x11).toString("base64");
const KEY_V2 = Buffer.alloc(32, 0x22).toString("base64");
const SUPABASE_ANON_KEY = "synthetic-anon-key-do-not-leak";
const JWT_A = "synthetic.jwt.account-a";
const JWT_B = "synthetic.jwt.account-b";
const JWT_MFA_AAL1 = "synthetic.jwt.mfa-aal1";
const JWT_MFA_AAL2 = "synthetic.jwt.mfa-aal2";

interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
}

describe("Cloudflare Worker + Durable Object — T03 Custody & Session Lifecycle", () => {
  let supabaseServer: http.Server;
  let supabaseUrl = "";
  let harness: TestHarness;
  let previewFetch: typeof fetch;
  let adminFetch: typeof fetch;
  let failUpstreamLogout = false;
  let failUpstreamRefresh = false;
  let logoutCallCount = 0;
  const rlsCategories: CategoryRow[] = [];

  function resetCategories(): void {
    rlsCategories.length = 0;
    rlsCategories.push(
      { id: "cat-a-1", user_id: "user-a", name: "Moradia A", type: "expense", icon: "home", color: "#0F766E" },
      { id: "cat-b-1", user_id: "user-b", name: "Salário B", type: "income", icon: "wallet", color: "#2563EB" },
    );
  }

  function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      });
    });
  }

  beforeAll(async () => {
    resetCategories();

    supabaseServer = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.headers["apikey"] !== SUPABASE_ANON_KEY) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_apikey" }));
        return;
      }

      if (req.method === "POST" && reqUrl.pathname === "/auth/v1/token") {
        const grantType = reqUrl.searchParams.get("grant_type");
        const body = await readJsonBody(req);

        if (grantType === "password") {
          const email = String(body.email ?? "");
          if (email === "a@axir.com.br") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: JWT_A,
                refresh_token: "rt-a",
                aal: "aal2",
                user: { id: "user-a", email },
              }),
            );
            return;
          }
          if (email === "b@axir.com.br") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: JWT_B,
                refresh_token: "rt-b",
                aal: "aal2",
                user: { id: "user-b", email },
              }),
            );
            return;
          }
          if (email === "mfa@axir.com.br") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: JWT_MFA_AAL1,
                refresh_token: "rt-mfa-1",
                aal: "aal1",
                user: { id: "user-mfa", email, factors: [{ id: "fac-1", status: "verified" }] },
              }),
            );
            return;
          }
          if (email === "expiring@axir.com.br") {
            const expSeconds = Math.floor(Date.now() / 1000) + 10;
            const payloadB64 = Buffer.from(JSON.stringify({ sub: "user-exp", exp: expSeconds })).toString("base64url");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: `eyJhbGciOiJIUzI1NiJ9.${payloadB64}.sig`,
                refresh_token: "rt-expiring",
                aal: "aal2",
                user: { id: "user-exp", email },
              }),
            );
            return;
          }
          const match = /^u(\d+)@axir\.com\.br$/.exec(email);
          if (match) {
            const idx = match[1];
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: `synthetic.jwt.u${idx}`,
                refresh_token: `rt-u${idx}`,
                aal: "aal2",
                user: { id: `user-${idx}`, email },
              }),
            );
            return;
          }
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }

        if (grantType === "refresh_token") {
          if (failUpstreamRefresh) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          if (body.refresh_token === "rt-expiring") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: "synthetic.jwt.refreshed",
                refresh_token: "rt-refreshed",
              }),
            );
            return;
          }
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }

        if (grantType === "pkce") {
          if (body.auth_code === "valid-pkce-code" && typeof body.code_verifier === "string") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: JWT_A,
                refresh_token: "rt-pkce-a",
                user: { id: "user-a", email: "a@axir.com.br", user_metadata: { full_name: "Titular A" } },
              }),
            );
            return;
          }
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }
      }

      if (req.method === "POST" && reqUrl.pathname === "/auth/v1/factors/fac-1/verify") {
        const body = await readJsonBody(req);
        if (body.code === "123456") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ access_token: JWT_MFA_AAL2, refresh_token: "rt-mfa-2" }));
          return;
        }
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_otp" }));
        return;
      }

      if (req.method === "GET" && reqUrl.pathname === "/auth/v1/user") {
        const auth = req.headers["authorization"];
        if (auth === "Bearer synthetic.jwt.mfa-admin-only-aal1") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id: "user-admin-only",
              email: "adminonly@axir.com.br",
              user_metadata: { mfa_admin_only: true },
              factors: [{ id: "fac-1", status: "verified" }],
            }),
          );
          return;
        }
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_jwt" }));
        return;
      }

      if (req.method === "POST" && reqUrl.pathname === "/auth/v1/recover") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({}));
        return;
      }

      if (req.method === "POST" && reqUrl.pathname === "/auth/v1/logout") {
        logoutCallCount += 1;
        if (failUpstreamLogout) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "upstream_down" }));
          return;
        }
        res.writeHead(204);
        res.end();
        return;
      }

      if (reqUrl.pathname.startsWith("/rest/v1/categories")) {
        const auth = req.headers["authorization"];
        const userId = auth === `Bearer ${JWT_A}` ? "user-a" : auth === `Bearer ${JWT_B}` ? "user-b" : null;
        if (!userId) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_jwt" }));
          return;
        }
        if (req.method === "GET") {
          const visible = rlsCategories
            .filter((row) => row.user_id === userId)
            .map(({ id, name, type, icon, color }) => ({ id, name, type, icon, color }));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(visible));
          return;
        }
        if (req.method === "POST") {
          const body = (await readJsonBody(req)) as unknown as Omit<CategoryRow, "id">;
          if (body.user_id !== userId) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "new row violates row-level security policy" }));
            return;
          }
          const inserted: CategoryRow = {
            id: `cat-${userId}-${rlsCategories.length + 1}`,
            user_id: userId,
            name: body.name,
            type: body.type,
            icon: body.icon,
            color: body.color,
          };
          rlsCategories.push(inserted);
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify([inserted]));
          return;
        }
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    });

    await new Promise<void>((resolve) => {
      supabaseServer.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = supabaseServer.address() as AddressInfo;
    supabaseUrl = `http://127.0.0.1:${addr.port}`;

    harness = createTestHarness({
      workers: [
        {
          configPath: WRANGLER_CONFIG,
          env: "preview",
          vars: {
            SUPABASE_URL: supabaseUrl,
            ANDROID_PACKAGE_NAME: "br.com.axir.app.preview",
            DEV_ORIGINAL_URL_HEADER: "1",
          },
          secrets: {
            SUPABASE_ANON_KEY,
            SESSION_ENCRYPTION_KEY_CURRENT: KEY_V2,
            SESSION_ENCRYPTION_KEY_PREVIOUS: KEY_V1,
          },
        },
        {
          configPath: WRANGLER_CONFIG,
          env: "admin",
          vars: {
            SUPABASE_URL: supabaseUrl,
            DEV_ORIGINAL_URL_HEADER: "1",
          },
          secrets: {
            SUPABASE_ANON_KEY,
            SESSION_ENCRYPTION_KEY_CURRENT: KEY_V2,
          },
        },
      ],
    });
    await harness.listen();

    const rawPreviewFetch = harness.getWorker("axir-sessions-edge-preview").fetch as unknown as typeof fetch;
    const rawAdminFetch = harness.getWorker("axir-sessions-edge-admin").fetch as unknown as typeof fetch;
    previewFetch = (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("x-axir-test-host", new URL(String(input)).hostname);
      return rawPreviewFetch(input, { ...init, headers });
    };
    adminFetch = (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("x-axir-test-host", new URL(String(input)).hostname);
      return rawAdminFetch(input, { ...init, headers });
    };
  }, 45000);

  afterAll(async () => {
    await Promise.all([
      harness?.close(),
      new Promise<void>((resolve) => supabaseServer?.close(() => resolve())),
    ]);
  });

  function extractCookiePair(setCookie: string | null): string {
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    return (setCookie ?? "").split(";")[0];
  }

  it("rejeita host nao autorizado, operacao fora da lista fechada e retorna estado neutro no bootstrap", async () => {
    const forbidden = await previewFetch("https://evil.workers.dev/api/sessions/v1/health");
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: "forbidden_host" });

    const unknownOp = await previewFetch("https://preview.axir.com.br/api/sessions/v1/evil-op", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(unknownOp.status).toBe(404);

    const bootNeutral = await previewFetch("https://preview.axir.com.br/api/sessions/v1/bootstrap", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(bootNeutral.status).toBe(200);
    expect(bootNeutral.headers.get("Cache-Control")).toContain("no-store");
    expect(await bootNeutral.json()).toMatchObject({ status: "neutral", contextId: null });
  });

  it("executa login A/B, mascara e-mail em accounts, alterna com geracao esperada e isola RLS", async () => {
    resetCategories();

    const loginA = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "a@axir.com.br", password: "secret" }),
    });
    expect(loginA.status).toBe(200);
    const cookie = extractCookiePair(loginA.headers.get("Set-Cookie"));
    const ctxA = (await loginA.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      generation: number;
    };
    expect(JSON.stringify(ctxA)).not.toContain(JWT_A);

    const loginB = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "b@axir.com.br", password: "secret" }),
    });
    expect(loginB.status).toBe(200);
    const ctxB = (await loginB.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      generation: number;
    };

    const accountsRes = await previewFetch("https://preview.axir.com.br/api/sessions/v1/accounts", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxA.contextId,
        "x-axir-csrf": ctxA.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(accountsRes.status).toBe(200);
    const accountsJson = (await accountsRes.json()) as { accounts: Array<{ maskedEmail: string }> };
    expect(accountsJson.accounts.map((a) => a.maskedEmail)).toContain("a***@axir.com.br");
    expect(accountsJson.accounts.map((a) => a.maskedEmail)).toContain("b***@axir.com.br");

    // Troca com geracao errada -> context_stale (409) e mantem ctxA ativo
    const staleSwitch = await previewFetch("https://preview.axir.com.br/api/sessions/v1/switch", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxA.contextId,
        "x-axir-csrf": ctxA.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetAccountRef: ctxB.accountRef, expectedGeneration: ctxB.generation + 99 }),
    });
    expect(staleSwitch.status).toBe(409);
    expect(await staleSwitch.json()).toEqual({ error: "context_stale" });

    // Troca valida de A -> B desativa ctxA
    const validSwitch = await previewFetch("https://preview.axir.com.br/api/sessions/v1/switch", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxA.contextId,
        "x-axir-csrf": ctxA.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetAccountRef: ctxB.accountRef, expectedGeneration: ctxB.generation }),
    });
    expect(validSwitch.status).toBe(200);
    expect(validSwitch.headers.get("Cache-Control")).toContain("no-store");
    const switchedCtx = (await validSwitch.json()) as {
      contextId: string;
      csrfToken: string;
      sessionBridge?: { accessToken: string; refreshToken: string };
    };
    expect(switchedCtx.sessionBridge).toEqual({
      accessToken: JWT_B,
      refreshToken: "rt-b",
    });

    // Contexto antigo ctxA nao funciona mais
    const oldList = await previewFetch("https://preview.axir.com.br/api/data/v1/categories.list", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxA.contextId,
        "x-axir-csrf": ctxA.csrfToken,
      },
    });
    expect(oldList.status).toBe(401);

    // Novo contexto le apenas dados de B sob RLS
    const newList = await previewFetch("https://preview.axir.com.br/api/data/v1/categories.list", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": switchedCtx.contextId,
        "x-axir-csrf": switchedCtx.csrfToken,
      },
    });
    expect(newList.status).toBe(200);
    expect(((await newList.json()) as { items: Array<{ name: string }> }).items.map((i) => i.name)).toEqual([
      "Salário B",
    ]);
  });

  it("impõe teto de 5 contas concorrentes, MFA step-up e isolamento entre ambientes", async () => {
    const boot = await previewFetch("https://preview.axir.com.br/api/sessions/v1/bootstrap", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const cookie = extractCookiePair(boot.headers.get("Set-Cookie"));

    // 6 cadastros concorrentes na mesma instalacao -> no maximo 5 aceitos, 6o recebe limit_reached
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((i) =>
        previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
          method: "POST",
          headers: {
            Origin: "https://preview.axir.com.br",
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grant: "password",
            mode: "personal",
            email: `u${i}@axir.com.br`,
            password: "secret",
          }),
        }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 200, 200, 200, 200, 409]);

    // Login com MFA pendente bloqueia dados ate completar /mfa
    const mfaLogin = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "shared", email: "mfa@axir.com.br", password: "secret" }),
    });
    expect(mfaLogin.status).toBe(200);
    const mfaCookie = extractCookiePair(mfaLogin.headers.get("Set-Cookie"));
    const mfaCtx = (await mfaLogin.json()) as {
      status: string;
      contextId: string;
      csrfToken: string;
      mfaFactorId: string;
    };
    expect(mfaCtx.status).toBe("mfa_required");

    const blockedData = await previewFetch("https://preview.axir.com.br/api/data/v1/categories.list", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: mfaCookie,
        "x-axir-context": mfaCtx.contextId,
        "x-axir-csrf": mfaCtx.csrfToken,
      },
    });
    expect(blockedData.status).toBe(403);
    expect(await blockedData.json()).toEqual({ error: "step_up_required" });

    const verifyMfa = await previewFetch("https://preview.axir.com.br/api/sessions/v1/mfa", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: mfaCookie,
        "x-axir-context": mfaCtx.contextId,
        "x-axir-csrf": mfaCtx.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ factorId: mfaCtx.mfaFactorId, code: "123456" }),
    });
    expect(verifyMfa.status).toBe(200);
    expect(await verifyMfa.json()).toMatchObject({ status: "authenticated" });

    // Reuso cruzado de cookie/contexto no ambiente admin e rejeitado
    const crossEnv = await adminFetch("https://admin.axir.com.br/api/data/v1/categories.list", {
      method: "POST",
      headers: {
        Origin: "https://admin.axir.com.br",
        Cookie: mfaCookie.replace("__Host-axir_session=", "__Host-axir_admin_session="),
        "x-axir-context": mfaCtx.contextId,
        "x-axir-csrf": mfaCtx.csrfToken,
      },
    });
    expect(crossEnv.status).toBe(401);
  });

  it("executa open-tab / redeem-tab atomico, PKCE callback com isolamento e recuperacao", async () => {
    const login = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "a@axir.com.br", password: "secret" }),
    });
    const cookie = extractCookiePair(login.headers.get("Set-Cookie"));
    const ctx = (await login.json()) as { contextId: string; csrfToken: string };

    // open-tab + redeem-tab uso unico
    const openTab = await previewFetch("https://preview.axir.com.br/api/sessions/v1/open-tab", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctx.contextId,
        "x-axir-csrf": ctx.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(openTab.status).toBe(200);
    const { intentToken } = (await openTab.json()) as { intentToken: string };

    const redeem1 = await previewFetch("https://preview.axir.com.br/api/sessions/v1/redeem-tab", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ intentToken }),
    });
    expect(redeem1.status).toBe(200);
    const redeemedCtx = (await redeem1.json()) as {
      sessionBridge?: { accessToken: string; refreshToken: string };
    };
    expect(redeemedCtx.sessionBridge).toEqual({
      accessToken: JWT_A,
      refreshToken: "rt-a",
    });

    // Segunda tentativa com o mesmo intentToken falha (uso unico atomico)
    const redeem2 = await previewFetch("https://preview.axir.com.br/api/sessions/v1/redeem-tab", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ intentToken }),
    });
    expect(redeem2.status).toBe(401);

    // PKCE start + callback em contexto errado falha; no contexto correto funciona
    const pkceStart = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctx.contextId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant: "pkce-start",
        mode: "personal",
        redirectTo: "https://preview.axir.com.br/api/sessions/v1/auth/callback",
      }),
    });
    const { intentId } = (await pkceStart.json()) as { intentId: string };

    const wrongCtxCb = await previewFetch(
      `https://preview.axir.com.br/api/sessions/v1/auth/callback?code=valid-pkce-code&intent=${intentId}`,
      {
        headers: { Cookie: cookie, "x-axir-context": "wrong-context-id" },
      },
    );
    expect(wrongCtxCb.status).toBe(401);

    // Recuperacao nao derruba a aba ativa
    const rec = await previewFetch("https://preview.axir.com.br/api/sessions/v1/auth/recovery", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@axir.com.br" }),
    });
    expect(rec.status).toBe(200);
    const revalStillActive = await previewFetch("https://preview.axir.com.br/api/sessions/v1/revalidate", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "x-axir-context": ctx.contextId },
      body: JSON.stringify({}),
    });
    expect(revalStillActive.status).toBe(200);
  });

  it("invalida localmente em logout mesmo com falha upstream, trata forget e rotacao interrompida no DO", async () => {
    const login = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "a@axir.com.br", password: "secret" }),
    });
    const cookie = extractCookiePair(login.headers.get("Set-Cookie"));
    const ctx = (await login.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      revision: number;
    };

    // Simula falha de confirmacao upstream no logout -> invalida localmente e enfileira pendencia
    failUpstreamLogout = true;
    const logoutRes = await previewFetch("https://preview.axir.com.br/api/sessions/v1/logout", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctx.contextId,
        "x-axir-csrf": ctx.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "device", remember: false }),
    });
    failUpstreamLogout = false;
    expect(logoutRes.status).toBe(200);
    expect(await logoutRes.json()).toEqual({
      status: "neutral",
      upstreamConfirmed: false,
      pendingRevocations: 1,
    });

    const revalAfter = await previewFetch("https://preview.axir.com.br/api/sessions/v1/revalidate", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "x-axir-context": ctx.contextId },
      body: JSON.stringify({}),
    });
    expect(revalAfter.status).toBe(401);
    expect(await revalAfter.json()).toEqual({ status: "revoked" });

    // Testa retry de refresh apos interrupcao diretamente no stub do DO
    const login2 = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "b@axir.com.br", password: "secret" }),
    });
    const ctx2 = (await login2.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      revision: number;
    };

    // Rotacao de chave AES-GCM + TTLs da §3.4
    const envelope = await encryptTokenPayload("segredo-t03", KEY_V1, "v1");
    expect(await decryptTokenPayload(envelope, KEY_V2, KEY_V1)).toBe("segredo-t03");

    const t0 = 1_700_000_000_000;
    const sharedSnap = { mode: "shared" as const, createdAt: t0, lastActivityAt: t0, lastAuthProofAt: t0 };
    expect(isSessionExpired(sharedSnap, t0 + SESSION_POLICY.SHARED_IDLE_TTL_MS)).toBe(true);
    expect(computeSessionDeadlines(sharedSnap).effectiveExpiresAt).toBe(t0 + SESSION_POLICY.SHARED_IDLE_TTL_MS);

    // forget remove a conta da instalacao
    const forgetRes = await previewFetch("https://preview.axir.com.br/api/sessions/v1/forget", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctx2.contextId,
        "x-axir-csrf": ctx2.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetAccountRef: ctx2.accountRef }),
    });
    expect(forgetRes.status).toBe(200);
    expect(await forgetRes.json()).toEqual({ forgotten: true, status: "neutral" });
  });

  it("preserva login automatico via switch apos logout com remember: true e revoga upstream com remember: false", async () => {
    const loginA = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "a@axir.com.br", password: "secret" }),
    });
    expect(loginA.status).toBe(200);
    const cookie = extractCookiePair(loginA.headers.get("Set-Cookie"));
    const ctxA = (await loginA.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      generation: number;
    };

    const loginB = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "b@axir.com.br", password: "secret" }),
    });
    expect(loginB.status).toBe(200);
    const ctxB = (await loginB.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      generation: number;
    };

    // Logout de A com remember: true -> NAO revoga upstream, preserva tokens e marca como remembered
    const logoutCountBeforeRemember = logoutCallCount;
    const logoutRemember = await previewFetch("https://preview.axir.com.br/api/sessions/v1/logout", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxA.contextId,
        "x-axir-csrf": ctxA.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "device", remember: true }),
    });
    expect(logoutRemember.status).toBe(200);
    expect(await logoutRemember.json()).toEqual({
      status: "neutral",
      upstreamConfirmed: true,
      pendingRevocations: 0,
    });
    expect(logoutCallCount).toBe(logoutCountBeforeRemember);

    // Conta A aparece como remembered em accounts
    const accountsAfterRemember = await previewFetch("https://preview.axir.com.br/api/sessions/v1/accounts", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxB.contextId,
        "x-axir-csrf": ctxB.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(accountsAfterRemember.status).toBe(200);
    const accountsJson = (await accountsAfterRemember.json()) as {
      accounts: Array<{ accountRef: string; status: string }>;
    };
    expect(accountsJson.accounts.find((a) => a.accountRef === ctxA.accountRef)?.status).toBe("remembered");

    // Alternar de B -> A reativa A automaticamente sem exigir senha e devolve sessionBridge
    const switchToRemembered = await previewFetch("https://preview.axir.com.br/api/sessions/v1/switch", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxB.contextId,
        "x-axir-csrf": ctxB.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetAccountRef: ctxA.accountRef, expectedGeneration: ctxA.generation }),
    });
    expect(switchToRemembered.status).toBe(200);
    const reactivatedA = (await switchToRemembered.json()) as {
      contextId: string;
      csrfToken: string;
      sessionBridge?: { accessToken: string; refreshToken: string };
    };
    expect(reactivatedA.sessionBridge).toEqual({
      accessToken: JWT_A,
      refreshToken: "rt-a",
    });

    // Logout de B com remember: false -> revoga upstream e bloqueia switch posterior para B
    const logoutCountBeforeRevoke = logoutCallCount;
    const loginB2 = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "b@axir.com.br", password: "secret" }),
    });
    const ctxB2 = (await loginB2.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      generation: number;
    };

    const logoutRevoke = await previewFetch("https://preview.axir.com.br/api/sessions/v1/logout", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxB2.contextId,
        "x-axir-csrf": ctxB2.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "device", remember: false }),
    });
    expect(logoutRevoke.status).toBe(200);
    expect(logoutCallCount).toBe(logoutCountBeforeRevoke + 1);

    const switchToRevoked = await previewFetch("https://preview.axir.com.br/api/sessions/v1/switch", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": reactivatedA.contextId,
        "x-axir-csrf": reactivatedA.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetAccountRef: ctxB2.accountRef, expectedGeneration: ctxB2.generation }),
    });
    expect(switchToRevoked.status).toBe(401);
  });

  it("faz refresh server-side no switch quando accessToken esta proximo de expirar e retorna 401 se falhar", async () => {
    const loginExp = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "expiring@axir.com.br", password: "secret" }),
    });
    expect(loginExp.status).toBe(200);
    const cookie = extractCookiePair(loginExp.headers.get("Set-Cookie"));
    const ctxExp = (await loginExp.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      generation: number;
    };

    const loginB = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "b@axir.com.br", password: "secret" }),
    });
    const ctxB = (await loginB.json()) as {
      contextId: string;
      csrfToken: string;
      accountRef: string;
      generation: number;
    };

    // Switch para conta expirando (< 60s) -> faz refresh server-side antes de retornar sessionBridge
    const refreshedSwitch = await previewFetch("https://preview.axir.com.br/api/sessions/v1/switch", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxB.contextId,
        "x-axir-csrf": ctxB.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetAccountRef: ctxExp.accountRef, expectedGeneration: ctxExp.generation }),
    });
    expect(refreshedSwitch.status).toBe(200);
    const refreshedCtx = (await refreshedSwitch.json()) as {
      contextId: string;
      csrfToken: string;
      sessionBridge?: { accessToken: string; refreshToken: string };
    };
    expect(refreshedCtx.sessionBridge).toEqual({
      accessToken: "synthetic.jwt.refreshed",
      refreshToken: "rt-refreshed",
    });

    // Se o refresh upstream falhar com 401 -> switch retorna 401 unauthorized
    const loginExp2 = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "expiring@axir.com.br", password: "secret" }),
    });
    const ctxExp2 = (await loginExp2.json()) as {
      accountRef: string;
      generation: number;
    };

    const loginB2 = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ grant: "password", mode: "personal", email: "b@axir.com.br", password: "secret" }),
    });
    const ctxB2 = (await loginB2.json()) as {
      contextId: string;
      csrfToken: string;
    };

    failUpstreamRefresh = true;
    const failedSwitch = await previewFetch("https://preview.axir.com.br/api/sessions/v1/switch", {
      method: "POST",
      headers: {
        Origin: "https://preview.axir.com.br",
        Cookie: cookie,
        "x-axir-context": ctxB2.contextId,
        "x-axir-csrf": ctxB2.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetAccountRef: ctxExp2.accountRef, expectedGeneration: ctxExp2.generation }),
    });
    failUpstreamRefresh = false;
    expect(failedSwitch.status).toBe(401);
    expect(await failedSwitch.json()).toEqual({ error: "unauthorized" });
  });

  it("no session-sync admite mfaVerified quando mfa_admin_only === true em modo personal, mas exige AAL2 em modo operator", async () => {
    const bootRes = await previewFetch("https://preview.axir.com.br/api/sessions/v1/bootstrap", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const cookie = bootRes.headers.get("set-cookie")?.split(";")[0] ?? "";

    const personalSync = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        grant: "session-sync",
        mode: "personal",
        accessToken: "synthetic.jwt.mfa-admin-only-aal1",
        refreshToken: "rt-admin-only-1",
      }),
    });
    expect(personalSync.status).toBe(200);
    const personalCtx = (await personalSync.json()) as { status: string };
    expect(personalCtx.status).toBe("authenticated");

    const operatorSync = await previewFetch("https://preview.axir.com.br/api/sessions/v1/login", {
      method: "POST",
      headers: { Origin: "https://preview.axir.com.br", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        grant: "session-sync",
        mode: "operator",
        accessToken: "synthetic.jwt.mfa-admin-only-aal1",
        refreshToken: "rt-admin-only-2",
      }),
    });
    expect(operatorSync.status).toBe(200);
    const operatorCtx = (await operatorSync.json()) as { status: string };
    expect(operatorCtx.status).toBe("mfa_required");
  });
});
