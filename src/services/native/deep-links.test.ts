import { App } from "@capacitor/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as platformModule from "./platform";
import {
  initDeepLinkListener,
  notifyDeepLink,
  parseAppUrl,
  subscribeDeepLink,
} from "./deep-links";

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(),
  },
}));

describe("deep-links service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseAppUrl", () => {
    it("converte URLs HTTPS com domínio nativo para rota interna", () => {
      expect(parseAppUrl("https://com.guiafinanceiro.app/transacoes?novo=despesa")).toBe(
        "/transacoes?novo=despesa",
      );
      expect(parseAppUrl("https://com.guiafinanceiro.app/cartoes")).toBe("/cartoes");
      expect(parseAppUrl("https://com.guiafinanceiro.app/")).toBe("/");
    });

    it("converte URLs com custom scheme para rota interna", () => {
      expect(parseAppUrl("com.guiafinanceiro.app://transacoes?novo=receita")).toBe(
        "/transacoes?novo=receita",
      );
    });

    it("retorna caminhos relativos inalterados", () => {
      expect(parseAppUrl("/transacoes?novo=despesa")).toBe("/transacoes?novo=despesa");
    });

    it("retorna rota raiz para entradas inválidas", () => {
      expect(parseAppUrl("")).toBe("/");
      expect(parseAppUrl("not-a-valid-url")).toBe("/");
    });
  });

  describe("subscribeDeepLink e notifyDeepLink", () => {
    it("notifica assinantes cadastrados", () => {
      const handler = vi.fn();
      const unsubscribe = subscribeDeepLink(handler);

      notifyDeepLink("/transacoes?novo=despesa");
      expect(handler).toHaveBeenCalledWith("/transacoes?novo=despesa");

      unsubscribe();
      notifyDeepLink("/cartoes");
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("initDeepLinkListener", () => {
    it("não registra listener no App do Capacitor em ambiente Web", () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
      const handler = vi.fn();

      const cleanup = initDeepLinkListener(handler);
      expect(App.addListener).not.toHaveBeenCalled();

      cleanup();
    });

    it("registra listener no App do Capacitor em ambiente nativo", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      const mockRemove = vi.fn();
      let capturedCallback: ((data: { url: string }) => void) | undefined;

      (App.addListener as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, callback: (data: { url: string }) => void) => {
          if (event === "appUrlOpen") {
            capturedCallback = callback;
          }
          return Promise.resolve({ remove: mockRemove });
        },
      );

      const handler = vi.fn();
      const cleanup = initDeepLinkListener(handler);

      expect(App.addListener).toHaveBeenCalledWith("appUrlOpen", expect.any(Function));

      // Simula a recepção de URL nativa
      capturedCallback?.({ url: "https://com.guiafinanceiro.app/transacoes?novo=receita" });
      expect(handler).toHaveBeenCalledWith("/transacoes?novo=receita");

      await cleanup();
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
