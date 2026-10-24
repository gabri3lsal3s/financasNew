import { describe, expect, it, vi } from "vitest";
import {
  buildTelegramSupportMessage,
  escapeTelegramHtml,
  formatDeviceInfo,
  formatTicketType,
  sendTelegramNotification,
} from "../../supabase/functions/_shared/telegram.ts";

describe("Tarefa 1.2 — Notificação no Telegram para Suporte (telegram.ts)", () => {
  describe("escapeTelegramHtml", () => {
    it("escapa caracteres especiais HTML para prevenir quebra de formatação no Telegram", () => {
      const raw = `<script>alert("XSS & more 'quotes'")</script>`;
      const escaped = escapeTelegramHtml(raw);

      expect(escaped).toBe(
        "&lt;script&gt;alert(&quot;XSS &amp; more &#039;quotes&#039;&quot;)&lt;/script&gt;",
      );
    });

    it("preserva textos sem caracteres especiais", () => {
      expect(escapeTelegramHtml("Texto comum sem tags")).toBe("Texto comum sem tags");
    });
  });

  describe("formatTicketType", () => {
    it("traduz corretamente todos os tipos de chamados", () => {
      expect(formatTicketType("doubt")).toBe("Dúvida de Uso");
      expect(formatTicketType("bug")).toBe("Problema (Bug)");
      expect(formatTicketType("suggestion")).toBe("Sugestão de Melhoria");
      expect(formatTicketType("other")).toBe("Outro");
      expect(formatTicketType("custom_unknown")).toBe("Outro");
    });
  });

  describe("formatDeviceInfo", () => {
    it("retorna 'Não informado' para valores vazios, nulos ou indefinidos", () => {
      expect(formatDeviceInfo(null)).toBe("Não informado");
      expect(formatDeviceInfo(undefined)).toBe("Não informado");
      expect(formatDeviceInfo({})).toBe("Não informado");
    });

    it("formata metadados detalhados com plataforma, PWA, resolução e UA", () => {
      const info = {
        platform: "Android",
        isNative: true,
        isPwa: false,
        screenResolution: "1080x2400",
        userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile",
      };

      const result = formatDeviceInfo(info);
      expect(result).toContain("Plataforma: Android");
      expect(result).toContain("Android Nativo");
      expect(result).toContain("Resolução: 1080x2400");
      expect(result).toContain("UA: Mozilla/5.0");
    });

    it("trunca user-agent longo para evitar ultrapassar limites de mensagem", () => {
      const veryLongUa = "A".repeat(100);
      const result = formatDeviceInfo({ userAgent: veryLongUa });
      expect(result).toContain("...");
      expect(result.length).toBeLessThan(100);
    });
  });

  describe("buildTelegramSupportMessage", () => {
    it("constrói mensagem rica com todas as seções e links HTML obrigatórios", () => {
      const message = buildTelegramSupportMessage({
        ticketId: "8f7a9d12-3b4c-5e6f-7a8b-9c0d1e2f3a4b",
        userName: "João da Silva",
        userEmail: "joao.silva@exemplo.com",
        type: "bug",
        subject: "Erro ao cadastrar ativo",
        message: "Ao tentar salvar o ativo PETR4, a tela congela.",
        currentRoute: "/investments",
        appVersion: "v2.73",
        deviceInfo: {
          platform: "Web",
          screenResolution: "1920x1080",
        },
      });

      expect(message).toContain("<b>[CHAMADO DE SUPORTE — ÁXIS FINANCE]</b>");
      expect(message).toContain("<b>Cliente:</b> João da Silva");
      expect(message).toContain(
        `<b>E-mail:</b> <a href="mailto:joao.silva@exemplo.com">joao.silva@exemplo.com</a>`,
      );
      expect(message).toContain("<b>Tipo:</b> Problema (Bug)");
      expect(message).toContain("<b>Assunto:</b> Erro ao cadastrar ativo");
      expect(message).toContain("<b>Rota no App:</b> <code>/investments</code>");
      expect(message).toContain("<b>Versão:</b> v2.73");
      expect(message).toContain("<b>Dispositivo:</b> Plataforma: Web | Resolução: 1920x1080");
      expect(message).toContain("<b>ID do Chamado:</b> <code>8f7a9d12-3b4c-5e6f-7a8b-9c0d1e2f3a4b</code>");
      expect(message).toContain("Ao tentar salvar o ativo PETR4, a tela congela.");
    });

    it("lida com campos opcionais ausentes sem gerar quebras", () => {
      const message = buildTelegramSupportMessage({
        type: "doubt",
        message: "Como exportar meus relatórios em PDF?",
      });

      expect(message).toContain("<b>Cliente:</b> Cliente não identificado");
      expect(message).toContain("<b>E-mail:</b> Não informado");
      expect(message).toContain("<b>Tipo:</b> Dúvida de Uso");
      expect(message).toContain("<b>Rota no App:</b> <code>/</code>");
      expect(message).toContain("<b>Versão:</b> Web");
      expect(message).not.toContain("<b>Assunto:</b>");
      expect(message).not.toContain("<b>ID do Chamado:</b>");
      expect(message).toContain("Como exportar meus relatórios em PDF?");
    });
  });

  describe("sendTelegramNotification", () => {
    it("falha graciosamente se as credenciais do Telegram estiverem ausentes", async () => {
      const res = await sendTelegramNotification({
        botToken: "",
        chatId: "",
        text: "Teste",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Credenciais do Telegram incompletas");
    });

    it("envia mensagem com sucesso quando a API do Telegram retorna 200 OK", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 12345 } }),
      } as Response);

      const res = await sendTelegramNotification({
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        chatId: "-100123456789",
        text: "<b>Teste</b>",
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendMessage",
      );
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string);
      expect(body).toEqual({
        chat_id: "-100123456789",
        text: "<b>Teste</b>",
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    });

    it("captura e reporta erro retornado pela API do Telegram (ex: token inválido)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ ok: false, error_code: 401, description: "Unauthorized" }),
      } as unknown as Response);

      const res = await sendTelegramNotification({
        botToken: "invalid_token",
        chatId: "12345",
        text: "Mensagem de teste",
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Telegram API retornou HTTP 401");
      expect(res.error).toContain("Unauthorized");
    });

    it("captura exceção de rede de forma segura", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Falha na conexão DNS"));

      const res = await sendTelegramNotification({
        botToken: "123456:valid_token",
        chatId: "12345",
        text: "Mensagem de teste",
        fetchFn: mockFetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Falha na requisição ao Telegram");
      expect(res.error).toContain("Falha na conexão DNS");
    });
  });
});
