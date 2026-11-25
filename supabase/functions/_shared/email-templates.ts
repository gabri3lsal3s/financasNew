/**
 * Templates de E-mail Transacionais Oficiais do Axir
 *
 * Arquitetura Visual Dual (DESIGN_SYSTEM.md v2.0 — Editorial Clean Light):
 * - Base Comum Light-First: Canvas (#F4F7F9), Card (#FFFFFF), Tipografia (#142531 / #475569)
 * - Identidade Não-Assinante / Trial ("teal"):
 *     Logo Oficial Teal (logo-teal-light-128.png) + Wordmark "Axir",
 *     Filete Superior #2A9D8F, Botão CTA #1B6B62, Callouts #F0FDFA / #2A9D8F.
 * - Identidade Exclusiva Assinante PRO ("pro"):
 *     Logo Oficial Axir PRO Ouro (logo-amber-light-128.png) + Wordmark "Axir" + Badge "PRO",
 *     Filete Superior #DDA726, Botão CTA #142531 com detalhe #DDA726, Callouts #FFFBEB / #DDA726.
 *
 * Conformidade estrita: AGENTS.md §4.8 (Zero emojis, tipografia sóbria e links de fallback).
 */

export type AxirEmailThemeVariant = "teal" | "pro";
export type AxirEmailAlertTone = "default" | "warning" | "critical";

export interface BaseEmailShellOptions {
  title: string;
  badge: string;
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  extraHtml?: string;
  /**
   * Define a identidade visual do e-mail:
   * - "teal" (padrão): Para usuários em período de teste (Trial), autenticação ou não-assinantes.
   * - "pro": Exclusivo para assinantes Axir PRO (usa logo dourada Axir PRO e paleta Ouro Âmbar).
   */
  themeVariant?: AxirEmailThemeVariant;
  /**
   * Tom semântico opcional para o badge de contexto (ex.: alertas de falha de pagamento).
   */
  alertTone?: AxirEmailAlertTone;
  /**
   * URL base da aplicação para resolução dos ativos de marca (padrão: https://axir.com.br).
   */
  brandBaseUrl?: string;
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeSafeEmailUrl(rawUrl: string | undefined, fallback = "https://axir.com.br"): string {
  const candidate = (rawUrl || "").trim();
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:") return parsed.toString();
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return parsed.toString();
    }
  } catch {
    // URL inválida usa fallback seguro
  }
  return fallback;
}

function resolveBrandAssetOrigin(rawUrl?: string): string {
  const safe = sanitizeSafeEmailUrl(rawUrl, "https://axir.com.br");
  try {
    const parsed = new URL(safe);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return "https://axir.com.br";
    }
    return parsed.origin;
  } catch {
    return "https://axir.com.br";
  }
}

export function renderAxirEmailShell(options: BaseEmailShellOptions): string {
  const currentYear = new Date().getFullYear();
  const variant: AxirEmailThemeVariant = options.themeVariant || "teal";
  const isPro = variant === "pro";
  const alertTone: AxirEmailAlertTone = options.alertTone || "default";

  const safeTitle = escapeHtmlText(options.title);
  const safeBadge = escapeHtmlText(options.badge);
  const safeHeading = escapeHtmlText(options.heading);
  const safeCtaText = options.ctaText ? escapeHtmlText(options.ctaText) : "";
  const safeCtaUrl = options.ctaUrl ? escapeHtmlText(sanitizeSafeEmailUrl(options.ctaUrl)) : "";

  const brandOrigin = resolveBrandAssetOrigin(options.brandBaseUrl || options.ctaUrl);
  const logoUrl = isPro
    ? `${brandOrigin}/brand/logo-amber-light-128.png`
    : `${brandOrigin}/brand/logo-teal-light-128.png`;
  const logoAlt = isPro ? "Axir PRO" : "Axir";

  // Tokens visuais por variante (Teal Petróleo vs Ouro Âmbar PRO)
  const cardBorderColor = isPro ? "#E6D5B8" : "#D7E1E6";
  const topAccentColor = isPro ? "#DDA726" : "#2A9D8F";
  const ctaBgColor = isPro ? "#142531" : "#1B6B62";
  const ctaBorderStyle = isPro ? "border: 1px solid #DDA726;" : "border: 1px solid #1B6B62;";
  const linkColor = isPro ? "#92400E" : "#1B6B62";

  // Cores semânticas do Badge de contexto
  let badgeBg = isPro ? "#FFFBEB" : "#F0FDFA";
  let badgeBorder = isPro ? "#FDE68A" : "#99F6E4";
  let badgeText = isPro ? "#92400E" : "#1B6B62";

  if (alertTone === "critical") {
    badgeBg = "#FEF2F2";
    badgeBorder = "#FECACA";
    badgeText = "#B23A2A";
  } else if (alertTone === "warning") {
    badgeBg = "#FFFBEB";
    badgeBorder = "#FDE68A";
    badgeText = "#92400E";
  }

  const proHeaderPill = isPro
    ? `<td valign="middle" style="padding-left: 8px;">
         <span style="display: inline-block; padding: 2px 8px; background-color: #FFFBEB; border: 1px solid #DDA726; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; color: #92400E; letter-spacing: 0.8px; text-transform: uppercase;">
           PRO
         </span>
       </td>`
    : "";

  const ctaBlock = safeCtaText && safeCtaUrl
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 24px 0;">
        <tr>
          <td align="center" style="border-radius: 12px; background-color: ${ctaBgColor}; ${ctaBorderStyle}">
            <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">
              ${safeCtaText}
            </a>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px; background-color: #F4F7F9; border: 1px solid #D7E1E6; border-radius: 10px; padding: 12px 16px;">
        <tr>
          <td>
            <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #475569; word-break: break-all;">
              Se o botão acima não funcionar, copie e cole este link no navegador:<br>
              <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="color: ${linkColor}; font-weight: 600; text-decoration: underline;">${safeCtaUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F7F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #142531;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F4F7F9; min-height: 100vh; padding: 36px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional Oficial Axir -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="${escapeHtmlText(logoUrl)}" alt="${escapeHtmlText(logoAlt)}" width="36" height="36" style="display: block; width: 36px; height: 36px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: #142531;">
                      Axir
                    </span>
                  </td>
                  ${proHeaderPill}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central Editorial Light -->
          <tr>
            <td style="background-color: #FFFFFF; border: 1px solid ${cardBorderColor}; border-top: 4px solid ${topAccentColor}; border-radius: 16px; padding: 36px 32px; box-shadow: 0 2px 8px rgba(20, 37, 49, 0.05);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <!-- Badge Semântico -->
                    <span style="display: inline-block; padding: 4px 12px; background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 9999px; font-size: 11px; font-weight: 700; color: ${badgeText}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      ${safeBadge}
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #142531; line-height: 1.35; letter-spacing: -0.3px;">
                      ${safeHeading}
                    </h1>

                    <div style="font-size: 15px; line-height: 1.65; color: #475569;">
                      ${options.bodyHtml}
                    </div>

                    ${ctaBlock}

                    ${options.extraHtml || ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 28px; padding-bottom: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; line-height: 1.5;">
                <strong>Axir</strong> &mdash; Clareza, controle financeiro e planejamento patrimonial.
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.5;">
                &copy; ${currentYear} Axir. Precisa de ajuda ou quer enviar uma sugestão? Responda a este e-mail ou escreva para
                <a href="mailto:suporte@axir.com.br" style="color: ${linkColor}; font-weight: 600; text-decoration: underline;">suporte@axir.com.br</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// 1. Template (TEAL): Boas-vindas ao Trial de 30 dias (Não-Assinante)
// -----------------------------------------------------------------------------
export function renderTrialWelcomeEmail(params: {
  name: string;
  trialDays: number;
  trialEndsFormatted: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safeEnds = escapeHtmlText(params.trialEndsFormatted);
  const subject = `Bem-vindo ao Axir - Seus ${params.trialDays} dias de teste gratuito começaram`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Sua conta no <strong style="color: #142531;">Axir</strong> está ativa. Você tem acesso completo a todas as ferramentas da plataforma durante seus <strong style="color: #142531;">${params.trialDays} dias de teste gratuito</strong>, válidos até <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeEnds}</strong>, sem necessidade de cadastrar cartão de crédito agora.
    </p>
    <div style="background-color: #F0FDFA; border: 1px solid #CCFBF1; border-left: 3px solid #2A9D8F; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #142531;">Por onde começar no seu painel:</p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">1. Registre suas receitas, despesas do mês e cartões de crédito.</p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">2. Defina limites de orçamento por categoria e acompanhe seu ritmo.</p>
      <p style="margin: 0; font-size: 13px; color: #475569;">3. Configure suas metas e simule aportes na sua carteira patrimonial.</p>
    </div>
    <p style="margin: 0;">
      Qualquer dúvida durante seus primeiros passos, basta responder diretamente a este e-mail.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Período de Teste Ativo",
    heading: `Boas-vindas ao Axir, ${firstName}`,
    bodyHtml,
    ctaText: "Acessar Meu Painel",
    ctaUrl: params.appUrl,
    themeVariant: "teal",
  });

  const text = `Olá, ${firstName}. Sua conta no Axir está ativa com ${params.trialDays} dias de teste gratuito até ${params.trialEndsFormatted}. Acesse seu painel: ${sanitizeSafeEmailUrl(params.appUrl)}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 2. Template (TEAL): Cartão cadastrado no Trial (Renovação Futura Agendada)
// -----------------------------------------------------------------------------
export function renderTrialCardScheduledEmail(params: {
  name: string;
  cardLast4: string;
  firstChargeDateFormatted: string;
  planName: string;
  planValueFormatted: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safeLast4 = escapeHtmlText(params.cardLast4);
  const safePlanName = escapeHtmlText(params.planName);
  const safePlanValue = escapeHtmlText(params.planValueFormatted);
  const safeChargeDate = escapeHtmlText(params.firstChargeDateFormatted);
  const subject = "Cartão validado no Axir - Sua assinatura está agendada para o fim do teste";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Seu cartão final <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeLast4}</strong> foi validado com sucesso para garantir a continuidade da sua conta após o período de avaliação gratuita.
    </p>
    <div style="background-color: #F0FDFA; border: 1px solid #CCFBF1; border-left: 3px solid #2A9D8F; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #142531;">Resumo do seu agendamento:</p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Plano escolhido: <strong style="color: #142531;">${safePlanName}</strong></p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Valor do ciclo: <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safePlanValue}</strong></p>
      <p style="margin: 0; font-size: 13px; color: #475569;">Primeira cobrança programada para: <strong style="font-family: 'IBM Plex Mono', monospace; color: #1B6B62;">${safeChargeDate}</strong></p>
    </div>
    <p style="margin: 0;">
      <strong style="color: #142531;">Nenhum valor foi cobrado hoje.</strong> Você continua aproveitando seus dias gratuitos normalmente e pode alterar ou cancelar este agendamento a qualquer momento antes de ${safeChargeDate} sem nenhum custo.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Renovação Agendada",
    heading: "Cartão validado sem cobrança hoje",
    bodyHtml,
    ctaText: "Gerenciar Minha Assinatura",
    ctaUrl: `${sanitizeSafeEmailUrl(params.appUrl)}/assinatura`,
    themeVariant: "teal",
  });

  const text = `Olá, ${firstName}. Seu cartão final ${params.cardLast4} foi cadastrado no Axir. Nenhuma cobrança foi realizada hoje. Sua primeira cobrança do ${params.planName} (${params.planValueFormatted}) ocorrerá apenas em ${params.firstChargeDateFormatted}.`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 3. Template (PRO - OURO ÂMBAR): Boas-vindas ao Axir PRO & Confirmação de Pagamento
// -----------------------------------------------------------------------------
export function renderProActivationEmail(params: {
  name: string;
  planName: string;
  periodEndFormatted: string;
  invoiceValueFormatted: string;
  invoicePdfUrl?: string;
  appUrl: string;
  /**
   * Quando true (padrão), inclui a carta especial de boas-vindas ao Axir PRO
   * e o canal direto de co-criação, sugestões e feedback com a equipe.
   */
  isFirstActivation?: boolean;
  /**
   * Quando informado (> 1), destaca que foi uma antecipação acumulativa de múltiplos meses.
   */
  cumulativeMonths?: number;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safePlanName = escapeHtmlText(params.planName);
  const safePeriodEnd = escapeHtmlText(params.periodEndFormatted);
  const safeInvoiceValue = escapeHtmlText(params.invoiceValueFormatted);
  const isFirst = params.isFirstActivation !== false;
  const cumulativeMonths = params.cumulativeMonths && params.cumulativeMonths > 1
    ? params.cumulativeMonths
    : null;

  const validatedInvoiceUrl = params.invoicePdfUrl
    ? sanitizeSafeEmailUrl(params.invoicePdfUrl, "")
    : "";

  const subject = isFirst
    ? `Boas-vindas ao Axir PRO - Assinatura e pagamento confirmados`
    : cumulativeMonths
      ? `Antecipação de +${cumulativeMonths} meses confirmada - Axir PRO`
      : `Renovação confirmada - ${params.planName} (Axir PRO)`;

  const badgeLabel = isFirst
    ? "Membro Axir PRO Ativo"
    : cumulativeMonths
      ? "Antecipação PRO Confirmada"
      : "Renovação PRO Confirmada";

  const headingLabel = isFirst
    ? `Boas-vindas ao Axir PRO, ${firstName}`
    : cumulativeMonths
      ? `Sua vigência PRO foi estendida em +${cumulativeMonths} meses`
      : "Sua assinatura Axir PRO foi renovada";

  const invoiceRow = validatedInvoiceUrl
    ? `<p style="margin: 10px 0 0 0; font-size: 13px;"><a href="${escapeHtmlText(validatedInvoiceUrl)}" target="_blank" rel="noopener noreferrer" style="color: #92400E; font-weight: 600; text-decoration: underline;">Visualizar comprovante de pagamento / fatura</a></p>`
    : "";

  const cumulativeRow = cumulativeMonths
    ? `<p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Ciclos adicionados: <strong style="color: #142531;">+${cumulativeMonths} meses somados integralmente</strong></p>`
    : "";

  const introParagraph = isFirst
    ? `É uma alegria ter você como assinante oficial do <strong style="color: #142531;">Axir PRO</strong>. Confirmamos o pagamento da sua assinatura <strong style="color: #142531;">${safePlanName}</strong> no valor de <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeInvoiceValue}</strong>.`
    : cumulativeMonths
      ? `Confirmamos o recebimento da sua antecipação de <strong style="color: #142531;">+${cumulativeMonths} meses</strong> do <strong style="color: #142531;">${safePlanName}</strong> no valor de <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeInvoiceValue}</strong>.`
      : `Confirmamos o recebimento do pagamento da sua assinatura <strong style="color: #142531;">${safePlanName}</strong> no valor de <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeInvoiceValue}</strong>.`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      ${introParagraph}
    </p>
    <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 4px solid #DDA726; padding: 16px 18px; border-radius: 10px; margin: 22px 0;">
      <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #92400E;">Comprovante da Assinatura PRO</p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Plano: <strong style="color: #142531;">${safePlanName}</strong></p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Valor liquidado: <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeInvoiceValue}</strong></p>
      ${cumulativeRow}
      <p style="margin: 0; font-size: 13px; color: #475569;">Acesso PRO garantido até: <strong style="font-family: 'IBM Plex Mono', monospace; color: #92400E;">${safePeriodEnd}</strong></p>
      ${invoiceRow}
    </div>
    <p style="margin: 0;">
      Todos os recursos exclusivos do modo PRO &mdash; relatórios executivos, projeções de longo prazo, rebalanceamento inteligente de carteira e sincronização em tempo real &mdash; estão liberados na sua conta.
    </p>
  `;

  // Bloco especial de pertencimento, canal aberto e co-criação para assinantes PRO
  const extraHtml = isFirst
    ? `
      <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #E6D5B8;">
        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #142531;">
          O Axir é construído para você &mdash; nosso canal está sempre aberto
        </p>
        <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.65; color: #475569;">
          Mais do que assinar uma ferramenta, a partir de hoje você faz parte direta da evolução do Axir. Queremos que você sinta que <strong>este aplicativo é verdadeiramente seu</strong>.
        </p>
        <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.65; color: #475569;">
          Sentiu falta de alguma funcionalidade na sua rotina? Tem alguma sugestão, pedido ou crítica construtiva sobre algo que podemos melhorar? <strong>Fale conosco com total liberdade.</strong>
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 1.65; color: #475569;">
          Basta <strong>responder diretamente a este e-mail</strong> ou abrir o canal de <strong>Suporte e Sugestões</strong> dentro do aplicativo. Cada mensagem enviada por quem é assinante PRO é lida com atenção pela nossa equipe e avaliada com prioridade para entrar nas próximas atualizações.
        </p>
      </div>
    `
    : `
      <p style="margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #E6D5B8; font-size: 12px; line-height: 1.6; color: #475569;">
        <strong>Canal direto do assinante PRO:</strong> Tem alguma sugestão, crítica ou ideia para uma próxima atualização do Axir? Responda diretamente a este e-mail a qualquer momento &mdash; ouvimos cada assinante de perto para evoluir o aplicativo para você.
      </p>
    `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: badgeLabel,
    heading: headingLabel,
    bodyHtml,
    ctaText: "Acessar Meu Painel PRO",
    ctaUrl: params.appUrl,
    extraHtml,
    themeVariant: "pro",
  });

  const welcomeTextSuffix = isFirst
    ? " O Axir é construído para você: se tiver qualquer sugestão, crítica ou solicitação para uma próxima atualização, basta responder diretamente a este e-mail."
    : " Sempre que tiver uma sugestão ou pedido de melhoria, basta responder a este e-mail.";

  const text = `Olá, ${firstName}. Boas-vindas ao Axir PRO! O pagamento de ${params.invoiceValueFormatted} referente ao ${params.planName} foi confirmado e sua vigência está ativa até ${params.periodEndFormatted}.${welcomeTextSuffix} Acesse seu painel: ${sanitizeSafeEmailUrl(params.appUrl)}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 4. Template (PRO - OURO ÂMBAR): Troca de Ciclo Agendada (Mensal <-> Anual)
// -----------------------------------------------------------------------------
export function renderProPlanChangeScheduledEmail(params: {
  name: string;
  currentPlanName: string;
  targetPlanName: string;
  targetPlanValueFormatted: string;
  effectiveDateFormatted: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safeCurrentPlan = escapeHtmlText(params.currentPlanName);
  const safeTargetPlan = escapeHtmlText(params.targetPlanName);
  const safeTargetValue = escapeHtmlText(params.targetPlanValueFormatted);
  const safeEffectiveDate = escapeHtmlText(params.effectiveDateFormatted);
  const subject = `Mudança para ${params.targetPlanName} agendada - Axir PRO`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Registramos o agendamento da mudança de ciclo da sua assinatura <strong style="color: #142531;">Axir PRO</strong> sem nenhuma perda dos seus dias já pagos.
    </p>
    <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 4px solid #DDA726; padding: 16px 18px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Ciclo atual: <strong style="color: #142531;">${safeCurrentPlan}</strong></p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Novo ciclo agendado: <strong style="color: #142531;">${safeTargetPlan} (${safeTargetValue})</strong></p>
      <p style="margin: 0; font-size: 13px; color: #475569;">Data da virada automática: <strong style="font-family: 'IBM Plex Mono', monospace; color: #92400E;">${safeEffectiveDate}</strong></p>
    </div>
    <p style="margin: 0;">
      Nenhuma cobrança adicional foi feita hoje. Seu plano atual segue ativo até <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeEffectiveDate}</strong>, quando a renovação passará automaticamente para o novo ciclo.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Alteração de Ciclo PRO",
    heading: "Mudança de plano agendada",
    bodyHtml,
    ctaText: "Ver Minha Assinatura PRO",
    ctaUrl: `${sanitizeSafeEmailUrl(params.appUrl)}/assinatura`,
    themeVariant: "pro",
  });

  const text = `Olá, ${firstName}. Sua mudança do ${params.currentPlanName} para o ${params.targetPlanName} (${params.targetPlanValueFormatted}) no Axir PRO foi agendada para ${params.effectiveDateFormatted}.`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 5. Template (PRO com Alerta Coral): Falha no pagamento da fatura recorrente
// -----------------------------------------------------------------------------
export function renderPaymentFailedEmail(params: {
  name: string;
  planName: string;
  retryDateFormatted?: string;
  updateCardUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safePlanName = escapeHtmlText(params.planName);
  const safeRetryDate = params.retryDateFormatted ? escapeHtmlText(params.retryDateFormatted) : "";
  const safeUpdateUrl = sanitizeSafeEmailUrl(params.updateCardUrl);
  const subject = "Atenção: não conseguimos processar a renovação da sua assinatura Axir PRO";

  const retryInfo = safeRetryDate
    ? `Uma nova tentativa automática será realizada em <strong style="font-family: 'IBM Plex Mono', monospace; color: #7F1D1D;">${safeRetryDate}</strong>.`
    : "Sua conta conta com um período de carência de 3 dias com acesso PRO mantido para que você possa atualizar seu cartão com tranquilidade.";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Identificamos uma recusa da operadora ao processar a renovação do seu <strong style="color: #142531;">${safePlanName}</strong> no Axir PRO.
    </p>
    <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-left: 4px solid #E76F51; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #991B1B;">${retryInfo}</p>
    </div>
    <p style="margin: 0;">
      Para manter todos os recursos do seu Axir PRO ativos sem interrupção, revise ou atualize o cartão de crédito clicando no botão abaixo:
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Atenção Necessária",
    heading: "Pendência na renovação do seu plano PRO",
    bodyHtml,
    ctaText: "Atualizar Cartão de Crédito",
    ctaUrl: safeUpdateUrl,
    themeVariant: "pro",
    alertTone: "critical",
  });

  const text = `Olá, ${firstName}. Não conseguimos processar o pagamento do seu ${params.planName} no Axir PRO. Atualize seu cartão para evitar interrupção no serviço: ${safeUpdateUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 6. Template: Confirmação de Cancelamento (PRO quando mantém vigência / TEAL no estorno imediato)
// -----------------------------------------------------------------------------
export function renderSubscriptionCanceledEmail(params: {
  name: string;
  isCdcRefund: boolean;
  effectiveUntilFormatted?: string;
  reactivateUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safeEffectiveUntil = escapeHtmlText(
    params.effectiveUntilFormatted || "o fim do período atual",
  );
  const safeReactivateUrl = sanitizeSafeEmailUrl(params.reactivateUrl);
  const subject = "Confirmação de cancelamento da assinatura Axir";

  // Se não é estorno imediato CDC, o usuário continua sendo assinante PRO ativo até current_period_end
  const themeVariant: AxirEmailThemeVariant = params.isCdcRefund ? "teal" : "pro";

  const messageDetails = params.isCdcRefund
    ? `
      <div style="background-color: #F0FDFA; border: 1px solid #CCFBF1; border-left: 3px solid #2A9D8F; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #142531;">Estorno Integral Solicitado (Prazo Legal de 7 dias - CDC)</p>
        <p style="margin: 0; font-size: 13px; color: #475569;">
          O reembolso de 100% do valor pago foi enviado à operadora e seu ciclo PRO foi encerrado. O lançamento do crédito na fatura seguirá o prazo do seu banco emissor.
        </p>
      </div>
      <p style="margin: 0 0 16px 0;">
        Sua conta agora opera no modo <strong style="color: #142531;">Somente Leitura</strong>. Todo o seu histórico financeiro permanece salvo com segurança para consulta e exportação.
      </p>
    `
    : `
      <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 4px solid #DDA726; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 4px 0; font-size: 13px; color: #475569;">Renovações futuras: <strong style="color: #142531;">Desativadas (não haverá novas cobranças)</strong></p>
        <p style="margin: 0; font-size: 13px; color: #475569;">Acesso PRO completo garantido até: <strong style="font-family: 'IBM Plex Mono', monospace; color: #92400E;">${safeEffectiveUntil}</strong></p>
      </div>
      <p style="margin: 0 0 16px 0;">
        Após <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeEffectiveUntil}</strong>, sua conta passará automaticamente para o modo <strong style="color: #142531;">Somente Leitura</strong>, mantendo todos os seus dados e histórico intactos.
      </p>
    `;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Confirmamos o processamento da sua solicitação de cancelamento no <strong style="color: #142531;">Axir</strong>.
    </p>
    ${messageDetails}
    <p style="margin: 0;">
      Se houver algo que possamos ter feito melhor na plataforma, fique à vontade para responder a este e-mail nos contando o motivo &mdash; seu feedback é muito valioso para nós.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Cancelamento Confirmado",
    heading: "Sua solicitação foi concluída",
    bodyHtml,
    ctaText: "Gerenciar ou Reativar Assinatura",
    ctaUrl: safeReactivateUrl,
    themeVariant,
  });

  const text = `Olá, ${firstName}. Confirmamos o cancelamento da sua assinatura no Axir. Seus dados continuam preservados. Você pode reativar quando quiser em: ${safeReactivateUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 7. Template (TEAL): Lembrete de fim de trial (3 dias antes - Não-Assinante)
// -----------------------------------------------------------------------------
export function renderTrialEndingReminderEmail(params: {
  name: string;
  daysRemaining: number;
  trialEndsFormatted: string;
  checkoutUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safeEnds = escapeHtmlText(params.trialEndsFormatted);
  const safeCheckoutUrl = sanitizeSafeEmailUrl(params.checkoutUrl);
  const daysLabel = params.daysRemaining === 1 ? "1 dia" : `${params.daysRemaining} dias`;
  const subject = `Seu teste gratuito no Axir termina em ${daysLabel}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Faltam <strong style="color: #142531;">${escapeHtmlText(daysLabel)}</strong> para o encerramento do seu período de avaliação gratuita no <strong style="color: #142531;">Axir</strong> (término em <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeEnds}</strong>).
    </p>
    <p style="margin: 0 0 16px 0;">
      Se o aplicativo está ajudando você a organizar suas contas, cartões e metas com clareza, escolha seu ciclo para continuar registrando lançamentos sem interrupção:
    </p>
    <div style="background-color: #F0FDFA; border: 1px solid #CCFBF1; border-left: 3px solid #2A9D8F; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; color: #142531;"><strong>Plano Pro Mensal:</strong> <span style="font-family: 'IBM Plex Mono', monospace;">R$ 19,99/mês</span></p>
      <p style="margin: 0; font-size: 13px; color: #142531;"><strong>Plano Pro Anual:</strong> <span style="font-family: 'IBM Plex Mono', monospace;">R$ 143,88/ano</span> (equivalente a <span style="font-family: 'IBM Plex Mono', monospace;">R$ 11,99/mês</span> &mdash; 40% de economia)</p>
    </div>
    <p style="margin: 0; font-size: 13px; color: #475569;">
      Caso opte por não assinar agora, fique tranquilo: seus dados nunca são apagados e sua conta permanecerá acessível em modo Somente Leitura.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Período de Teste Encerrando",
    heading: "Continue no controle das suas finanças",
    bodyHtml,
    ctaText: "Escolher Meu Plano PRO",
    ctaUrl: safeCheckoutUrl,
    themeVariant: "teal",
  });

  const text = `Olá, ${firstName}. Faltam ${daysLabel} para o fim do seu teste gratuito no Axir (até ${params.trialEndsFormatted}). Escolha seu plano PRO em: ${safeCheckoutUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 8. Template (TEAL): Encerramento do trial e transição para Somente Leitura
// -----------------------------------------------------------------------------
export function renderTrialExpiredReadOnlyEmail(params: {
  name: string;
  reactivateUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safeReactivateUrl = sanitizeSafeEmailUrl(params.reactivateUrl);
  const subject = "Seu período de testes no Axir terminou - Seus dados estão salvos";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Seu período de 30 dias de avaliação gratuita no <strong style="color: #142531;">Axir</strong> chegou ao fim.
    </p>
    <div style="background-color: #F4F7F9; border: 1px solid #D7E1E6; border-left: 3px solid #2A9D8F; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #142531;">
        Sua conta agora está no modo <strong>Somente Leitura</strong>. Todos os seus lançamentos, cartões, metas e patrimônio continuam <strong>100% salvos e intactos</strong> para consulta e exportação.
      </p>
    </div>
    <p style="margin: 0;">
      Para voltar a registrar novas transações e desbloquear todos os recursos do aplicativo, você pode ativar o <strong style="color: #142531;">Axir PRO</strong> a qualquer momento.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Modo Somente Leitura",
    heading: "Seus dados continuam seguros com você",
    bodyHtml,
    ctaText: "Ativar Meu Plano PRO",
    ctaUrl: safeReactivateUrl,
    themeVariant: "teal",
  });

  const text = `Olá, ${firstName}. Seu teste gratuito no Axir terminou. Sua conta está em modo Somente Leitura e todos os seus dados estão 100% salvos. Ative o Axir PRO quando quiser em: ${safeReactivateUrl}`;

  return { subject, html, text };
}

export interface SundayDigestEmailParams {
  name: string;
  periodLabel: string;
  totalWeeklySpentBRL: string;
  expenseCount: number;
  topCategoryName?: string | null;
  topCategorySpentBRL?: string | null;
  upcomingCount: number;
  upcomingTotalBRL: string;
  appUrl: string;
  managePrefsUrl: string;
  /**
   * Quando true, renderiza o Resumo Semanal com a identidade Ouro Âmbar e Logo Axir PRO.
   * Quando false/omitido, renderiza com a identidade Teal Petróleo.
   */
  isPro?: boolean;
}

// -----------------------------------------------------------------------------
// 9. Template (ADAPTATIVO TEAL / PRO): Resumo Semanal de Domingo (opt-in explícito)
// -----------------------------------------------------------------------------
export function renderSundayDigestEmail(
  params: SundayDigestEmailParams,
): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safePeriod = escapeHtmlText(params.periodLabel);
  const safeTotal = escapeHtmlText(params.totalWeeklySpentBRL);
  const safeTopCategory = params.topCategoryName
    ? escapeHtmlText(params.topCategoryName)
    : null;
  const safeTopAmount = params.topCategorySpentBRL
    ? escapeHtmlText(params.topCategorySpentBRL)
    : null;
  const safeUpcomingTotal = escapeHtmlText(params.upcomingTotalBRL);
  const safeAppUrl = sanitizeSafeEmailUrl(params.appUrl);
  const safeManagePrefsUrl = sanitizeSafeEmailUrl(
    params.managePrefsUrl,
    "https://axir.com.br/configuracoes?tab=notifications",
  );
  const isPro = Boolean(params.isPro);
  const themeVariant: AxirEmailThemeVariant = isPro ? "pro" : "teal";

  const boxBg = isPro ? "#FFFBEB" : "#F0FDFA";
  const boxBorder = isPro ? "#FDE68A" : "#CCFBF1";
  const boxAccent = isPro ? "#DDA726" : "#2A9D8F";
  const linkColor = isPro ? "#92400E" : "#1B6B62";

  const countLabel =
    params.expenseCount === 1
      ? "1 lançamento"
      : `${params.expenseCount} lançamentos`;

  const subject = isPro
    ? `Resumo da Semana Axir PRO (${params.periodLabel})`
    : `Resumo da Semana Axir (${params.periodLabel})`;

  const topCategoryRow =
    safeTopCategory && safeTopAmount
      ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Maior categoria da semana: <strong style="color: #142531;">${safeTopCategory}</strong> (<span style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeTopAmount}</span>)</p>`
      : "";

  const upcomingRow =
    params.upcomingCount > 0
      ? `<p style="margin: 0; font-size: 13px; color: #475569;">Contas e obrigações nos próximos dias: <strong style="color: #142531;">${params.upcomingCount}</strong> (<span style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeUpcomingTotal}</span>)</p>`
      : `<p style="margin: 0; font-size: 13px; color: #475569;">Contas e obrigações: tudo em dia nos próximos dias.</p>`;

  const summaryBoxHtml =
    params.expenseCount === 0 && params.upcomingCount === 0
      ? `
      <div style="background-color: ${boxBg}; border: 1px solid ${boxBorder}; border-left: 4px solid ${boxAccent}; padding: 16px; border-radius: 10px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #142531;">Semana tranquila por aqui: nenhum gasto registrado neste período.</p>
        <p style="margin: 0; font-size: 13px; color: #475569;">Nenhuma conta ou obrigação pendente para os próximos dias.</p>
      </div>
    `
      : `
      <div style="background-color: ${boxBg}; border: 1px solid ${boxBorder}; border-left: 4px solid ${boxAccent}; padding: 16px; border-radius: 10px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">Total de saídas na semana (${countLabel}): <strong style="font-family: 'IBM Plex Mono', monospace; color: #142531;">${safeTotal}</strong></p>
        ${topCategoryRow}
        ${upcomingRow}
      </div>
    `;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Aqui está o seu balanço consolidado da semana de <strong style="color: #142531;">${safePeriod}</strong>.
    </p>
    ${summaryBoxHtml}
    <p style="margin: 0;">
      Você recebe este boletim porque ativou o Resumo Semanal de Domingo nas suas preferências.
    </p>
  `;

  const extraHtml = `
    <p style="margin: 20px 0 0 0; font-size: 11px; line-height: 1.5; color: #64748B;">
      Deseja pausar ou ajustar seus avisos? Gerencie a qualquer momento em
      <a href="${escapeHtmlText(safeManagePrefsUrl)}" target="_blank" rel="noopener noreferrer" style="color: ${linkColor}; font-weight: 600; text-decoration: underline;">Configurações de Notificações</a>.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: isPro ? "Resumo Semanal PRO" : "Resumo Semanal",
    heading: "Consolidado dos últimos 7 dias",
    bodyHtml,
    ctaText: isPro ? "Abrir Meu Painel PRO" : "Abrir Visão Geral",
    ctaUrl: safeAppUrl,
    extraHtml,
    themeVariant,
  });

  const textParts =
    params.expenseCount === 0 && params.upcomingCount === 0
      ? [
          `Olá, ${firstName}. ${subject}:`,
          "Semana tranquila: nenhum gasto registrado e nenhuma conta vencendo nos próximos dias.",
          `Acesse: ${safeAppUrl}`,
          `Gerenciar resumo: ${safeManagePrefsUrl}`,
        ]
      : [
          `Olá, ${firstName}. ${subject}:`,
          `Total gasto (${countLabel}): ${params.totalWeeklySpentBRL}.`,
          params.topCategoryName && params.topCategorySpentBRL
            ? `Maior categoria: ${params.topCategoryName} (${params.topCategorySpentBRL}).`
            : "",
          params.upcomingCount > 0
            ? `Contas e obrigações em aberto: ${params.upcomingCount} (${params.upcomingTotalBRL}).`
            : "Tudo em dia nos próximos dias.",
          `Acesse: ${safeAppUrl}`,
          `Gerenciar resumo: ${safeManagePrefsUrl}`,
        ].filter(Boolean);

  return { subject, html, text: textParts.join(" ") };
}

// -----------------------------------------------------------------------------
// 9. Template: Lembrete Automático / Oficial de Pendência de Pagamento (Past Due)
// -----------------------------------------------------------------------------
export type PastDueReminderPreset = "friendly" | "update_card" | "final_warning";

export function renderPastDueWeeklyReminderEmail(params: {
  name: string;
  planName: string;
  preset?: PastDueReminderPreset;
  blockDateFormatted?: string | null;
  manageUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safePlanName = escapeHtmlText(params.planName);
  const safeManageUrl = sanitizeSafeEmailUrl(params.manageUrl);
  const safeBlockDate = params.blockDateFormatted ? escapeHtmlText(params.blockDateFormatted) : null;
  const preset: PastDueReminderPreset = params.preset ?? "friendly";

  let subject = "Lembrete: regularize o pagamento da sua assinatura Axir PRO";
  let badge = "Aviso de Pagamento";
  let heading = "Sua assinatura Axir PRO está com pagamento pendente";
  let alertTone: "warning" | "critical" = "warning";
  let introText = `Identificamos que a renovação do seu <strong style="color: #142531;">${safePlanName}</strong> ainda está pendente. Mantivemos seu acesso completo liberado para não atrapalhar seu controle financeiro.`;
  let ctaText = "Regularizar Pagamento";

  if (preset === "update_card") {
    subject = "Atualize seu cartão para manter sua assinatura Axir PRO em dia";
    heading = "Renovação aguardando atualização do cartão";
    introText = `A cobrança recorrente do seu <strong style="color: #142531;">${safePlanName}</strong> não foi compensada. Você pode atualizar os dados do seu cartão ou optar pelo Plano Anual via PIX em menos de 1 minuto.`;
    ctaText = "Atualizar Forma de Pagamento";
  } else if (preset === "final_warning") {
    subject = "Aviso importante: sua conta Axir entrará em modo somente-leitura";
    badge = "Último Aviso";
    heading = "Prazo final para regularização do Axir PRO";
    alertTone = "critical";
    introText = `O pagamento do seu <strong style="color: #142531;">${safePlanName}</strong> segue em aberto. Para evitar a transição para o modo somente-leitura, regularize sua assinatura pelo link abaixo.`;
    ctaText = "Manter Meu Acesso PRO";
  }

  const deadlineBox = safeBlockDate
    ? `<div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-left: 4px solid #E76F51; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 13px; color: #991B1B;">
          Sem a confirmação do pagamento, sua conta entrará em modo somente-leitura em <strong style="font-family: 'IBM Plex Mono', monospace;">${safeBlockDate}</strong>. Seus dados permanecem 100% preservados.
        </p>
      </div>`
    : `<div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 4px solid #DDA726; padding: 14px 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 13px; color: #92400E;">
          Seu acesso continua liberado temporariamente. Assim que o pagamento for confirmado, a cobrança volta ao ciclo normal automaticamente.
        </p>
      </div>`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong style="color: #142531;">${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">${introText}</p>
    ${deadlineBox}
    <p style="margin: 0;">
      Se você já realizou o pagamento hoje, pode desconsiderar este aviso automático.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge,
    heading,
    bodyHtml,
    ctaText,
    ctaUrl: safeManageUrl,
    themeVariant: "pro",
    alertTone,
  });

  const text = `Olá, ${firstName}. O pagamento do seu ${params.planName} no Axir PRO está pendente.${safeBlockDate ? ` Sem regularização, a conta entrará em modo somente-leitura em ${params.blockDateFormatted}.` : ""} Regularize em: ${safeManageUrl}`;

  return { subject, html, text };
}
