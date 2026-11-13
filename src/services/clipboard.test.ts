import { describe, it, expect, vi, beforeEach } from "vitest";
import { canReadClipboardSilently, readClipboardText, writeClipboardText } from "./clipboard";

describe("clipboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        readText: vi.fn().mockResolvedValue(""),
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });
  });

  describe("canReadClipboardSilently", () => {
    it("retorna false quando navigator.permissions não estiver disponível", async () => {
      const origPermissions = navigator.permissions;
      Object.defineProperty(navigator, "permissions", {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const canRead = await canReadClipboardSilently();
      expect(canRead).toBe(false);

      Object.defineProperty(navigator, "permissions", {
        value: origPermissions,
        configurable: true,
        writable: true,
      });
    });

    it("retorna false quando permissão for 'prompt' (evitando o popup nativo do Chrome)", async () => {
      Object.defineProperty(navigator, "permissions", {
        value: {
          query: vi.fn().mockResolvedValue({ state: "prompt" }),
        },
        configurable: true,
        writable: true,
      });

      const canRead = await canReadClipboardSilently();
      expect(canRead).toBe(false);
    });

    it("retorna false quando permissão for 'denied'", async () => {
      Object.defineProperty(navigator, "permissions", {
        value: {
          query: vi.fn().mockResolvedValue({ state: "denied" }),
        },
        configurable: true,
        writable: true,
      });

      const canRead = await canReadClipboardSilently();
      expect(canRead).toBe(false);
    });

    it("retorna true quando permissão estiver concedida ('granted')", async () => {
      Object.defineProperty(navigator, "permissions", {
        value: {
          query: vi.fn().mockResolvedValue({ state: "granted" }),
        },
        configurable: true,
        writable: true,
      });

      const canRead = await canReadClipboardSilently();
      expect(canRead).toBe(true);
    });
  });

  describe("readClipboardText", () => {
    it("retorna success quando clipboard tiver texto", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          readText: vi.fn().mockResolvedValue("Pix de R$ 50,00"),
        },
        configurable: true,
        writable: true,
      });

      const res = await readClipboardText();
      expect(res.status).toBe("success");
      if (res.status === "success") {
        expect(res.text).toBe("Pix de R$ 50,00");
      }
    });

    it("retorna empty quando clipboard tiver apenas espaços", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          readText: vi.fn().mockResolvedValue("   "),
        },
        configurable: true,
        writable: true,
      });

      const res = await readClipboardText();
      expect(res.status).toBe("empty");
    });
  });

  describe("writeClipboardText", () => {
    it("escreve texto com sucesso", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      const ok = await writeClipboardText("teste");
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith("teste");
    });
  });
});
