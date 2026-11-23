import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Tarefa 1.3 — Content-Security-Policy (CSP) & Segurança de Borda em public/_headers", () => {
  const headersPath = resolve(root, "public/_headers");

  it("arquivo public/_headers existe e pode ser lido", () => {
    expect(existsSync(headersPath)).toBe(true);
  });

  it("contém a diretiva Content-Security-Policy estrita no bloco global /*", () => {
    const content = readFileSync(headersPath, "utf8");
    expect(content).toContain("Content-Security-Policy:");

    // Extrai o valor do cabeçalho CSP
    const cspMatch = content.match(/Content-Security-Policy:\s*([^\r\n]+)/);
    expect(cspMatch).not.toBeNull();
    const csp = cspMatch?.[1] ?? "";

    // Valida diretivas obrigatórias de contenção
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("https://challenges.cloudflare.com");
    // Verifica o hash exato do script inline de tema/splash em index.html
    const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");
    const inlineScriptMatch = indexHtml.match(
      /<script(?![^>]*src=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(inlineScriptMatch).not.toBeNull();
    const expectedHash = createHash("sha256")
      .update(inlineScriptMatch?.[1] ?? "", "utf8")
      .digest("base64");
    expect(csp).toContain(`'sha256-${expectedHash}'`);
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: https://*.supabase.co");
    expect(csp).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://challenges.cloudflare.com https://brapi.dev"
    );
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("frame-src 'self' https://challenges.cloudflare.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("autoriza o widget Cloudflare Turnstile em script-src, frame-src e connect-src", () => {
    const content = readFileSync(headersPath, "utf8");
    const cspMatch = content.match(/Content-Security-Policy:\s*([^\r\n]+)/);
    const csp = cspMatch?.[1] ?? "";

    expect(csp).toMatch(/script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  });

  it("permite worker-src blob e cdn.jsdelivr.net para OCR client-side com Tesseract.js sem wildcards", () => {
    const content = readFileSync(headersPath, "utf8");
    const cspMatch = content.match(/Content-Security-Policy:\s*([^\r\n]+)/);
    const csp = cspMatch?.[1] ?? "";

    expect(csp).toContain("worker-src 'self' blob: https://cdn.jsdelivr.net");
    expect(csp).toMatch(/script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  });

  it("não possui wildcards permissivos (*) em script-src ou connect-src", () => {
    const content = readFileSync(headersPath, "utf8");
    const cspMatch = content.match(/Content-Security-Policy:\s*([^\r\n]+)/);
    const csp = cspMatch?.[1] ?? "";

    const scriptMatch = csp.match(/script-src\s+([^;]+)/);
    const scriptSrc = scriptMatch?.[1] ?? "";
    expect(scriptSrc.split(/\s+/)).not.toContain("*");

    const connectMatch = csp.match(/connect-src\s+([^;]+)/);
    const connectSrc = connectMatch?.[1] ?? "";
    expect(connectSrc.split(/\s+/)).not.toContain("*");
  });

  it("preserva os cabeçalhos de defesa em profundidade essenciais", () => {
    const content = readFileSync(headersPath, "utf8");
    expect(content).toContain("X-Content-Type-Options: nosniff");
    expect(content).toContain("X-Frame-Options: DENY");
    expect(content).toContain("Referrer-Policy: strict-origin-when-cross-origin");
    expect(content).toContain(
      "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), interest-cohort=()",
    );
  });
});
