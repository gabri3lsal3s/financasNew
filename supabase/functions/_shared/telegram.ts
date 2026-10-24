/**
 * Utilitários compartilhados para integração com o Telegram Bot API.
 * Formatação de mensagens ricas em HTML, escape seguro e envio de notificações de suporte.
 */

export interface SupportTicketNotificationData {
  userName?: string | null;
  userEmail?: string | null;
  type: "doubt" | "bug" | "suggestion" | "other" | string;
  subject?: string | null;
  message: string;
  currentRoute?: string | null;
  appVersion?: string | null;
  deviceInfo?: Record<string, unknown> | null;
  ticketId?: string | null;
}

/**
 * Escapa caracteres especiais para modo HTML do Telegram Bot API
 * Evita injeção ou quebra de formatação de tags HTML.
 */
export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Traduz e formata o tipo de chamado para leitura amigável
 */
export function formatTicketType(type: string): string {
  switch (type) {
    case "bug":
      return "Problema (Bug)";
    case "suggestion":
      return "Sugestão de Melhoria";
    case "doubt":
      return "Dúvida de Uso";
    case "other":
    default:
      return "Outro";
  }
}

/**
 * Formata os metadados de dispositivo e ambiente de execução
 */
export function formatDeviceInfo(info?: Record<string, unknown> | null): string {
  if (!info || typeof info !== "object" || Object.keys(info).length === 0) {
    return "Não informado";
  }

  const parts: string[] = [];

  if (info.platform) {
    parts.push(`Plataforma: ${String(info.platform)}`);
  }
  if (info.isPwa === true) {
    parts.push("PWA instalado");
  }
  if (info.isNative === true) {
    parts.push("Android Nativo");
  }
  if (info.screenResolution) {
    parts.push(`Resolução: ${String(info.screenResolution)}`);
  } else if (info.screen) {
    parts.push(`Resolução: ${String(info.screen)}`);
  }
  if (info.locale) {
    parts.push(`Idioma: ${String(info.locale)}`);
  }
  if (info.userAgent) {
    const ua = String(info.userAgent);
    const shortUa = ua.length > 70 ? `${ua.slice(0, 67)}...` : ua;
    parts.push(`UA: ${shortUa}`);
  }

  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(info);
}

/**
 * Monta o corpo da mensagem formatada em HTML para o Telegram
 */
export function buildTelegramSupportMessage(data: SupportTicketNotificationData): string {
  const lines: (string | null)[] = [
    `<b>[CHAMADO DE SUPORTE — ÁXIS FINANCE]</b>\n`,
    `<b>Cliente:</b> ${escapeTelegramHtml(data.userName || "Cliente não identificado")}`,
    data.userEmail
      ? `<b>E-mail:</b> <a href="mailto:${escapeTelegramHtml(data.userEmail)}">${escapeTelegramHtml(data.userEmail)}</a>`
      : `<b>E-mail:</b> Não informado`,
    `<b>Tipo:</b> ${escapeTelegramHtml(formatTicketType(data.type))}`,
    data.subject ? `<b>Assunto:</b> ${escapeTelegramHtml(data.subject)}` : null,
    `<b>Rota no App:</b> <code>${escapeTelegramHtml(data.currentRoute || "/")}</code>`,
    `<b>Versão:</b> ${escapeTelegramHtml(data.appVersion || "Web")}`,
    `<b>Dispositivo:</b> ${escapeTelegramHtml(formatDeviceInfo(data.deviceInfo))}`,
    data.ticketId ? `<b>ID do Chamado:</b> <code>${escapeTelegramHtml(data.ticketId)}</code>` : null,
    `\n<b>Mensagem:</b>\n${escapeTelegramHtml(data.message.trim())}`,
  ];

  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

/**
 * Envia notificação para o chat do Telegram especificado
 */
export async function sendTelegramNotification(params: {
  botToken: string;
  chatId: string;
  text: string;
  fetchFn?: typeof fetch;
}): Promise<{ success: boolean; error?: string }> {
  const { botToken, chatId, text, fetchFn = fetch } = params;

  if (!botToken || !chatId) {
    return { success: false, error: "Credenciais do Telegram incompletas" };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `Telegram API retornou HTTP ${response.status}: ${errText}`,
      };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Falha na requisição ao Telegram: ${msg}` };
  }
}
