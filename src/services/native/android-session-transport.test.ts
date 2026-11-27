import { describe, expect, it } from "vitest";
import {
  buildAndroidSessionTransportUrl,
  validateAndroidAppLinkHttps,
  validateAndroidSessionTransportRequest,
} from "./android-session-transport";

describe("android-session-transport", () => {
  it("aceita App Link HTTPS válido em host e caminho do contrato oficial", () => {
    const res = validateAndroidAppLinkHttps("https://axir.com.br/lembretes?tab=hoje");
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.host).toBe("axir.com.br");
      expect(res.pathname).toBe("/lembretes");
    }
  });

  it("rejeita esquemas inseguros ou customizados fora de App Link HTTPS", () => {
    for (const url of [
      "http://axir.com.br/lembretes",
      "axir://lembretes",
      "javascript:alert(1)",
      "data:text/html,hi",
    ]) {
      const res = validateAndroidAppLinkHttps(url);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.code).toBe("insecure_scheme");
      }
    }
  });

  it("rejeita hosts fora do contrato, userinfo e portas customizadas", () => {
    const evilHost = validateAndroidAppLinkHttps("https://evil.com/lembretes");
    expect(evilHost.valid).toBe(false);
    if (!evilHost.valid) expect(evilHost.code).toBe("host_not_allowed");

    const lookalike = validateAndroidAppLinkHttps("https://axir.com.br.evil.com/lembretes");
    expect(lookalike.valid).toBe(false);
    if (!lookalike.valid) expect(lookalike.code).toBe("host_not_allowed");

    const userinfo = validateAndroidAppLinkHttps("https://axir.com.br@evil.com/lembretes");
    expect(userinfo.valid).toBe(false);
    if (!userinfo.valid) expect(userinfo.code).toBe("userinfo_not_allowed");

    const customPort = validateAndroidAppLinkHttps("https://axir.com.br:8443/lembretes");
    expect(customPort.valid).toBe(false);
    if (!customPort.valid) expect(customPort.code).toBe("port_not_allowed");
  });

  it("rejeita caminhos fora do contrato e parâmetros de redirecionamento ou troca de conta", () => {
    const badPath = validateAndroidAppLinkHttps("https://axir.com.br/admin/panel");
    expect(badPath.valid).toBe(false);
    if (!badPath.valid) expect(badPath.code).toBe("path_not_allowed");

    const traversal = validateAndroidAppLinkHttps("https://axir.com.br/r/../admin");
    expect(traversal.valid).toBe(false);
    if (!traversal.valid) expect(traversal.code).toBe("path_not_allowed");

    const blockedParam = validateAndroidAppLinkHttps("https://axir.com.br/lembretes?switchAccount=u2");
    expect(blockedParam.valid).toBe(false);
    if (!blockedParam.valid) expect(blockedParam.code).toBe("blocked_query_param");
  });

  it("valida operação fechada e installation_id no transporte de sessão", () => {
    const ok = validateAndroidSessionTransportRequest({
      operation: "handoff",
      targetUrl: "https://financasnew.gabrielisaacsales.workers.dev/meta/123",
      installationId: "inst_android_123456",
      recipientVersion: 2,
    });
    expect(ok.ok).toBe(true);

    const badOp = validateAndroidSessionTransportRequest({
      operation: "arbitrary_exec",
      targetUrl: "https://axir.com.br/lembretes",
      installationId: "inst_android_123456",
    });
    expect(badOp.ok).toBe(false);
    if (!badOp.ok) expect(badOp.code).toBe("invalid_operation");

    const badInst = validateAndroidSessionTransportRequest({
      operation: "open_route",
      targetUrl: "https://axir.com.br/lembretes",
      installationId: "short",
    });
    expect(badInst.ok).toBe(false);
    if (!badInst.ok) expect(badInst.code).toBe("invalid_payload");
  });

  it("constrói URL de transporte validada e lança erro para destinos fora do contrato", () => {
    const url = buildAndroidSessionTransportUrl({
      host: "axir.com.br",
      path: "/viagem/abc",
      operation: "verify_app_link",
      installationId: "inst_android_123456",
    });
    expect(url).toBe("https://axir.com.br/viagem/abc");

    expect(() =>
      buildAndroidSessionTransportUrl({
        host: "axir.com.br",
        path: "/rota-inexistente",
        operation: "open_route",
        installationId: "inst_android_123456",
      }),
    ).toThrow();
  });
});
