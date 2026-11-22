/**
 * Templates de E-mail Transacionais Oficiais do Axir
 * Padrão canônico de design system: Dark Canvas (#0B0F19), Card (#111827), Teal (#0D9488)
 * Conformidade estrita: AGENTS.md §4.8 (Zero emojis, tipografia sóbria e links de fallback)
 */

interface BaseEmailShellOptions {
  title: string;
  badge: string;
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  extraHtml?: string;
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

export function renderAxirEmailShell(options: BaseEmailShellOptions): string {
  const currentYear = new Date().getFullYear();
  const safeTitle = escapeHtmlText(options.title);
  const safeBadge = escapeHtmlText(options.badge);
  const safeHeading = escapeHtmlText(options.heading);
  const safeCtaText = options.ctaText ? escapeHtmlText(options.ctaText) : "";
  const safeCtaUrl = options.ctaUrl ? escapeHtmlText(sanitizeSafeEmailUrl(options.ctaUrl)) : "";

  const ctaBlock = safeCtaText && safeCtaUrl
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 24px 0;">
        <tr>
          <td align="center" style="border-radius: 8px; background-color: #0D9488;">
            <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
              ${safeCtaText}
            </a>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px; background-color: #1F2937; border-radius: 8px; padding: 12px 16px;">
        <tr>
          <td>
            <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #9CA3AF; word-break: break-all;">
              Se o botão acima não funcionar, copie e cole este link no navegador:<br>
              <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="color: #14B8A6; text-decoration: underline;">${safeCtaUrl}</a>
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
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #F9FAFB;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0B0F19; min-height: 100vh; padding: 36px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional Axir -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                      AXIR<span style="color: #0D9488; font-weight: 400; margin-left: 4px;">FINANCE</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8;">
                      Inteligência &amp; Soberania Financeira
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central -->
          <tr>
            <td style="background-color: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <!-- Badge Semântico -->
                    <span style="display: inline-block; padding: 4px 12px; background-color: rgba(13, 148, 136, 0.15); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #14B8A6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      ${safeBadge}
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #F9FAFB; line-height: 1.35;">
                      ${safeHeading}
                    </h1>

                    <div style="font-size: 14px; line-height: 1.6; color: #9CA3AF;">
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
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #6B7280; line-height: 1.5;">
                &copy; ${currentYear} Axir. Todos os direitos reservados.<br>
                Plataforma de Gestão Financeira Pessoal de Alta Precisão.
              </p>
              <p style="margin: 0; font-size: 11px; color: #6B7280;">
                Precisa de ajuda? Fale conosco em <a href="mailto:suporte@axir.com.br" style="color: #9CA3AF; text-decoration: underline;">suporte@axir.com.br</a>
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
// 1. Template: Boas-vindas ao Trial de 30 dias
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
  const subject = `Bem-vindo ao Axir - Seus ${params.trialDays} dias de teste começaram`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Sua conta no <strong>Axir</strong> está ativa. Você tem acesso completo aos recursos da plataforma durante seus <strong>${params.trialDays} dias de teste gratuito</strong>, válidos até <strong>${safeEnds}</strong>.
    </p>
    <p style="margin: 0 0 16px 0;">
      Aproveite para organizar suas contas, lançar receitas e despesas, planejar orçamentos e acompanhar suas projeções patrimoniais.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Período de Testes Ativo",
    heading: `Bem-vindo ao Axir, ${firstName}`,
    bodyHtml,
    ctaText: "Acessar Meu Painel",
    ctaUrl: params.appUrl,
  });

  const text = `Olá, ${firstName}. Sua conta no Axir está ativa com ${params.trialDays} dias de teste gratuito até ${params.trialEndsFormatted}. Acesse seu painel: ${sanitizeSafeEmailUrl(params.appUrl)}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 2. Template: Cartão cadastrado no Trial (Renovação Agendada)
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
  const subject = "Cartão cadastrado com sucesso - Renovação agendada";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Seu cartão final <strong>${safeLast4}</strong> foi validado e vinculado à sua conta com sucesso.
    </p>
    <div style="background-color: #1F2937; border-left: 3px solid #0D9488; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #F9FAFB;">Informações do Agendamento:</p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Plano: <strong>${safePlanName}</strong></p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Valor da assinatura: <strong>${safePlanValue}</strong></p>
      <p style="margin: 0; font-size: 13px; color: #D1D5DB;">Primeira cobrança apenas em: <strong>${safeChargeDate}</strong></p>
    </div>
    <p style="margin: 0 0 16px 0;">
      <strong>Nenhum valor foi debitado hoje.</strong> Você continuará aproveitando seu período de testes gratuito sem interrupções e poderá cancelar o agendamento a qualquer momento antes do primeiro vencimento.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Renovação Agendada",
    heading: "Cartão validado com sucesso",
    bodyHtml,
    ctaText: "Gerenciar Minha Assinatura",
    ctaUrl: `${sanitizeSafeEmailUrl(params.appUrl)}/assinatura`,
  });

  const text = `Olá, ${firstName}. Seu cartão final ${params.cardLast4} foi cadastrado. Nenhuma cobrança foi realizada hoje. Sua primeira cobrança do plano ${params.planName} (${params.planValueFormatted}) ocorrerá apenas em ${params.firstChargeDateFormatted}.`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 3. Template: Confirmação de Assinatura Pro / Renovação Confirmada
// -----------------------------------------------------------------------------
export function renderProActivationEmail(params: {
  name: string;
  planName: string;
  periodEndFormatted: string;
  invoiceValueFormatted: string;
  invoicePdfUrl?: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safePlanName = escapeHtmlText(params.planName);
  const safePeriodEnd = escapeHtmlText(params.periodEndFormatted);
  const safeInvoiceValue = escapeHtmlText(params.invoiceValueFormatted);
  const validatedInvoiceUrl = params.invoicePdfUrl
    ? sanitizeSafeEmailUrl(params.invoicePdfUrl, "")
    : "";
  const subject = `Confirmação de Pagamento - ${params.planName}`;

  const invoiceRow = validatedInvoiceUrl
    ? `<p style="margin: 12px 0 0 0; font-size: 13px;"><a href="${escapeHtmlText(validatedInvoiceUrl)}" target="_blank" rel="noopener noreferrer" style="color: #14B8A6; text-decoration: underline;">Visualizar comprovante / fatura</a></p>`
    : "";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Confirmamos o recebimento do pagamento da sua assinatura <strong>${safePlanName}</strong> no valor de <strong>${safeInvoiceValue}</strong>.
    </p>
    <div style="background-color: #1F2937; border-left: 3px solid #0D9488; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Status: <strong>Ativo</strong></p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Vigência garantida até: <strong>${safePeriodEnd}</strong></p>
      ${invoiceRow}
    </div>
    <p style="margin: 0 0 16px 0;">
      Todos os recursos de gestão financeira, relatórios executivos e projeções patrimoniais estão liberados.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Pagamento Confirmado",
    heading: "Sua assinatura Pro está ativa",
    bodyHtml,
    ctaText: "Acessar Plataforma",
    ctaUrl: params.appUrl,
  });

  const text = `Olá, ${firstName}. O pagamento de ${params.invoiceValueFormatted} do ${params.planName} foi confirmado. Seu acesso está garantido até ${params.periodEndFormatted}. Acesse: ${sanitizeSafeEmailUrl(params.appUrl)}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 4. Template: Falha no pagamento da fatura
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
  const subject = "Atenção: não conseguimos processar o pagamento da sua assinatura";

  const retryInfo = safeRetryDate
    ? `Uma nova tentativa de processamento será realizada em <strong>${safeRetryDate}</strong>.`
    : "Por favor, revise os dados do seu cartão para manter seu acesso sem interrupções.";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Identificamos uma instabilidade ao processar a cobrança da assinatura do seu <strong>${safePlanName}</strong> junto à operadora do cartão.
    </p>
    <div style="background-color: #1F2937; border-left: 3px solid #EF4444; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #FCA5A5;">${retryInfo}</p>
    </div>
    <p style="margin: 0 0 16px 0;">
      Para evitar interrupções, atualize a forma de pagamento clicando no botão abaixo:
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Atenção Necessária",
    heading: "Pendência de Pagamento",
    bodyHtml,
    ctaText: "Atualizar Forma de Pagamento",
    ctaUrl: safeUpdateUrl,
  });

  const text = `Olá, ${firstName}. Não conseguimos processar o pagamento do ${params.planName}. Atualize seu cartão para evitar interrupção no serviço: ${safeUpdateUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 5. Template: Confirmação de Cancelamento
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

  const messageDetails = params.isCdcRefund
    ? `
      <p style="margin: 0 0 16px 0;">
        Como sua solicitação ocorreu dentro do prazo legal de 7 dias (CDC), o <strong>estorno integral</strong> foi solicitado e seu plano Pro foi encerrado. O crédito dependerá do fechamento da fatura do seu banco emissor.
      </p>
      <p style="margin: 0 0 16px 0;">
        Sua conta agora opera no modo <strong>Somente Leitura</strong>. Seus dados financeiros históricos permanecem salvos com segurança.
      </p>
    `
    : `
      <p style="margin: 0 0 16px 0;">
        Sua assinatura foi cancelada e não haverá novas cobranças.
      </p>
      <p style="margin: 0 0 16px 0;">
        Seu acesso completo ao Plano Pro continuará ativo até <strong>${safeEffectiveUntil}</strong>. Após essa data, sua conta passará automaticamente para o modo Somente Leitura.
      </p>
    `;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Confirmamos o cancelamento da sua assinatura no <strong>Axir</strong>.
    </p>
    ${messageDetails}
    <p style="margin: 0 0 16px 0;">
      Quando quiser reativar sua assinatura, basta acessar sua conta com seu login habitual.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Cancelamento Confirmado",
    heading: "Assinatura Cancelada",
    bodyHtml,
    ctaText: "Reativar Minha Assinatura",
    ctaUrl: safeReactivateUrl,
  });

  const text = `Olá, ${firstName}. Confirmamos o cancelamento da sua assinatura no Axir. Seus dados continuam preservados. Você pode reativar quando quiser em: ${safeReactivateUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 6. Template: Lembrete de fim de trial (3 dias antes)
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
    <p style="margin: 0 0 16px 0;">Olá, <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Faltam <strong>${escapeHtmlText(daysLabel)}</strong> para o encerramento do seu período de testes gratuito no <strong>Axir</strong> (término em <strong>${safeEnds}</strong>).
    </p>
    <p style="margin: 0 0 16px 0;">
      Para manter suas projeções e continuar lançando novas despesas sem interrupção, escolha o plano ideal para você.
    </p>
    <div style="background-color: #1F2937; border-left: 3px solid #0D9488; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Plano Pro Mensal: R$ 19,99/mês</p>
      <p style="margin: 0; font-size: 13px; color: #D1D5DB;">Plano Pro Anual: R$ 143,88/ano (equivalente a R$ 11,99/mês - 40% de economia)</p>
    </div>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Período de Teste Expirando",
    heading: "Não perca o ritmo do seu controle",
    bodyHtml,
    ctaText: "Garantir Meu Plano Pro",
    ctaUrl: safeCheckoutUrl,
  });

  const text = `Olá, ${firstName}. Faltam ${daysLabel} para o fim do seu teste gratuito no Axir (até ${params.trialEndsFormatted}). Garanta seu plano Pro em: ${safeCheckoutUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 7. Template: Encerramento do trial e transição para Somente Leitura
// -----------------------------------------------------------------------------
export function renderTrialExpiredReadOnlyEmail(params: {
  name: string;
  reactivateUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] || "Cliente" : "Cliente";
  const safeName = escapeHtmlText(firstName);
  const safeReactivateUrl = sanitizeSafeEmailUrl(params.reactivateUrl);
  const subject = "Seu período de testes no Axir terminou";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Seu período de testes de 30 dias no <strong>Axir</strong> chegou ao fim.
    </p>
    <p style="margin: 0 0 16px 0;">
      Sua conta passou para o modo <strong>Somente Leitura</strong>. Todos os seus dados, cartões, metas e histórico continuam <strong>100% salvos e intactos</strong> para consulta e exportação.
    </p>
    <p style="margin: 0 0 16px 0;">
      Para voltar a cadastrar novas transações e utilizar todos os recursos do app, assine o Plano Pro a qualquer momento.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Modo Somente Leitura",
    heading: "Seus dados continuam seguros",
    bodyHtml,
    ctaText: "Reativar Plano Pro",
    ctaUrl: safeReactivateUrl,
  });

  const text = `Olá, ${firstName}. Seu teste gratuito no Axir terminou. Sua conta está em modo Somente Leitura e todos os seus dados estão salvos. Reative o Pro em: ${safeReactivateUrl}`;

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
}

// -----------------------------------------------------------------------------
// 8. Template: Resumo Semanal de Domingo (opt-in explícito)
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

  const countLabel =
    params.expenseCount === 1
      ? "1 lançamento"
      : `${params.expenseCount} lançamentos`;

  const subject = `Resumo da Semana Axir (${params.periodLabel})`;

  const topCategoryRow =
    safeTopCategory && safeTopAmount
      ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #D1D5DB;">Maior categoria da semana: <strong>${safeTopCategory}</strong> (${safeTopAmount})</p>`
      : "";

  const upcomingRow =
    params.upcomingCount > 0
      ? `<p style="margin: 0; font-size: 13px; color: #D1D5DB;">Contas e faturas em aberto (próximos dias): <strong>${params.upcomingCount}</strong> (${safeUpcomingTotal})</p>`
      : `<p style="margin: 0; font-size: 13px; color: #D1D5DB;">Contas e faturas em aberto: tudo em dia nos próximos dias.</p>`;

  const summaryBoxHtml =
    params.expenseCount === 0 && params.upcomingCount === 0
      ? `
      <div style="background-color: #1F2937; border-left: 3px solid #0D9488; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #D1D5DB;">Semana tranquila por aqui: nenhum gasto registrado neste período.</p>
        <p style="margin: 0; font-size: 13px; color: #D1D5DB;">Nenhuma conta ou fatura vencendo nos próximos dias.</p>
      </div>
    `
      : `
      <div style="background-color: #1F2937; border-left: 3px solid #0D9488; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #D1D5DB;">Total gasto na semana (${countLabel}): <strong>${safeTotal}</strong></p>
        ${topCategoryRow}
        ${upcomingRow}
      </div>
    `;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Olá, <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Aqui está o seu resumo semanal de <strong>${safePeriod}</strong>.
    </p>
    ${summaryBoxHtml}
    <p style="margin: 0 0 12px 0;">
      Você recebe este e-mail porque ativou o Resumo Semanal de Domingo nas suas configurações.
    </p>
  `;

  const extraHtml = `
    <p style="margin: 20px 0 0 0; font-size: 11px; line-height: 1.5; color: #6B7280;">
      Deseja pausar ou alterar seus avisos? Gerencie em
      <a href="${escapeHtmlText(safeManagePrefsUrl)}" target="_blank" rel="noopener noreferrer" style="color: #14B8A6; text-decoration: underline;">Configurações de Notificações</a>.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Resumo Semanal",
    heading: "Consolidado dos últimos 7 dias",
    bodyHtml,
    ctaText: "Abrir Visão Geral",
    ctaUrl: safeAppUrl,
    extraHtml,
  });

  const textParts =
    params.expenseCount === 0 && params.upcomingCount === 0
      ? [
          `Olá, ${firstName}. Resumo Semanal Axir (${params.periodLabel}):`,
          "Semana tranquila: nenhum gasto registrado e nenhuma conta vencendo nos próximos dias.",
          `Acesse: ${safeAppUrl}`,
          `Desativar resumo: ${safeManagePrefsUrl}`,
        ]
      : [
          `Olá, ${firstName}. Resumo Semanal Axir (${params.periodLabel}):`,
          `Total gasto (${countLabel}): ${params.totalWeeklySpentBRL}.`,
          params.topCategoryName && params.topCategorySpentBRL
            ? `Maior categoria: ${params.topCategoryName} (${params.topCategorySpentBRL}).`
            : "",
          params.upcomingCount > 0
            ? `Contas e faturas em aberto: ${params.upcomingCount} (${params.upcomingTotalBRL}).`
            : "Tudo em dia nos próximos dias.",
          `Acesse: ${safeAppUrl}`,
          `Desativar resumo: ${safeManagePrefsUrl}`,
        ].filter(Boolean);

  return { subject, html, text: textParts.join(" ") };
}
