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

export function renderAxirEmailShell(options: BaseEmailShellOptions): string {
  const currentYear = new Date().getFullYear();
  const ctaBlock = options.ctaText && options.ctaUrl
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 24px 0;">
        <tr>
          <td align="center" style="border-radius: 8px; background-color: #0D9488;">
            <a href="${options.ctaUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
              ${options.ctaText}
            </a>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px; background-color: #1F2937; border-radius: 8px; padding: 12px 16px;">
        <tr>
          <td>
            <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #9CA3AF; word-break: break-all;">
              Se o botao acima nao funcionar, copie e cole este link no navegador:<br>
              <a href="${options.ctaUrl}" target="_blank" rel="noopener noreferrer" style="color: #14B8A6; text-decoration: underline;">${options.ctaUrl}</a>
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
  <title>${options.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #F9FAFB;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0B0F19; min-height: 100vh; padding: 36px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabecalho Institucional Axir -->
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
                      Inteligencia &amp; Soberania Financeira
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
                    <!-- Badge Semantico -->
                    <span style="display: inline-block; padding: 4px 12px; background-color: rgba(13, 148, 136, 0.15); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #14B8A6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      ${options.badge}
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #F9FAFB; line-height: 1.35;">
                      ${options.heading}
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

          <!-- Rodape Institucional -->
          <tr>
            <td align="center" style="padding-top: 28px; padding-bottom: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #6B7280; line-height: 1.5;">
                &copy; ${currentYear} Axir. Todos os direitos reservados.<br>
                Plataforma de Gestao Financeira Pessoal de Alta Precisao.
              </p>
              <p style="margin: 0; font-size: 11px; color: #6B7280;">
                Precisa de ajuda? Fale conosco em <a href="mailto:ajuda@axir.com.br" style="color: #9CA3AF; text-decoration: underline;">ajuda@axir.com.br</a>
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
  const firstName = params.name ? params.name.split(" ")[0] : "Cliente";
  const subject = `Bem-vindo ao Axir - Seus ${params.trialDays} dias de teste comecaram`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Ola, <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Sua conta no <strong>Axir</strong> esta ativa. Voce tem acesso irrestrito a todos os recursos da plataforma durante seus <strong>${params.trialDays} dias de teste gratuito</strong>, validos ate <strong>${params.trialEndsFormatted}</strong>.
    </p>
    <p style="margin: 0 0 16px 0;">
      Aproveite para organizar suas contas, lancar receitas e despesas, planejar orcamentos e experimentar o motor de projecao patrimonial.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Periodo de Testes Ativo",
    heading: `Bem-vindo ao Axir, ${firstName}`,
    bodyHtml,
    ctaText: "Acessar Meu Painel",
    ctaUrl: params.appUrl,
  });

  const text = `Ola, ${firstName}. Sua conta no Axir esta ativa com ${params.trialDays} dias de teste gratuito ate ${params.trialEndsFormatted}. Acesse seu painel: ${params.appUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 2. Template: Cartao cadastrado no Trial (Renovacao Agendada)
// -----------------------------------------------------------------------------
export function renderTrialCardScheduledEmail(params: {
  name: string;
  cardLast4: string;
  firstChargeDateFormatted: string;
  planName: string;
  planValueFormatted: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] : "Cliente";
  const subject = "Cartao cadastrado com sucesso - Renovacao agendada";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Ola, <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Seu cartao final <strong>${params.cardLast4}</strong> foi validado e vinculado a sua conta com sucesso.
    </p>
    <div style="background-color: #1F2937; border-left: 3px solid #0D9488; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #F9FAFB;">Informacoes do Agendamento:</p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Plano: <strong>${params.planName}</strong></p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Valor da assinatura: <strong>${params.planValueFormatted}</strong></p>
      <p style="margin: 0; font-size: 13px; color: #D1D5DB;">Primeira cobranca apenas em: <strong>${params.firstChargeDateFormatted}</strong></p>
    </div>
    <p style="margin: 0 0 16px 0;">
      <strong>Nenhum valor foi debitado hoje.</strong> Voce continuara aproveitando seu periodo de testes gratuito sem interrupcoes e podera cancelar o agendamento a qualquer momento antes do primeiro vencimento.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Renovacao Agendada",
    heading: "Cartao validado com sucesso",
    bodyHtml,
    ctaText: "Gerenciar Minha Assinatura",
    ctaUrl: `${params.appUrl}/assinatura`,
  });

  const text = `Ola, ${firstName}. Seu cartao final ${params.cardLast4} foi cadastrado. Nenhuma cobranca foi realizada hoje. Sua primeira cobranca do plano ${params.planName} (${params.planValueFormatted}) ocorrera apenas em ${params.firstChargeDateFormatted}.`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 3. Template: Confirmacao de Assinatura Pro / Renovacao Confirmada
// -----------------------------------------------------------------------------
export function renderProActivationEmail(params: {
  name: string;
  planName: string;
  periodEndFormatted: string;
  invoiceValueFormatted: string;
  invoicePdfUrl?: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] : "Cliente";
  const subject = `Confirmacao de Pagamento - ${params.planName}`;

  const invoiceRow = params.invoicePdfUrl
    ? `<p style="margin: 12px 0 0 0; font-size: 13px;"><a href="${params.invoicePdfUrl}" target="_blank" rel="noopener noreferrer" style="color: #14B8A6; text-decoration: underline;">Visualizar comprovante fiscal / fatura</a></p>`
    : "";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Ola, <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Confirmamos o recebimento do pagamento da sua assinatura do <strong>${params.planName}</strong> no valor de <strong>${params.invoiceValueFormatted}</strong>.
    </p>
    <div style="background-color: #1F2937; border-left: 3px solid #0D9488; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Status: <strong>Ativo</strong></p>
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Vigencia garantida ate: <strong>${params.periodEndFormatted}</strong></p>
      ${invoiceRow}
    </div>
    <p style="margin: 0 0 16px 0;">
      Todos os recursos avancados de gestao financeira, relatorios executivos e motores de projecao patrimonial estao liberados.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Pagamento Confirmado",
    heading: "Sua assinatura Pro esta ativa",
    bodyHtml,
    ctaText: "Acessar Plataforma",
    ctaUrl: params.appUrl,
  });

  const text = `Ola, ${firstName}. O pagamento de ${params.invoiceValueFormatted} do ${params.planName} foi confirmado. Seu acesso esta garantido ate ${params.periodEndFormatted}. Acesse: ${params.appUrl}`;

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
  const firstName = params.name ? params.name.split(" ")[0] : "Cliente";
  const subject = "Importante: Nao conseguimos processar o pagamento da sua assinatura";

  const retryInfo = params.retryDateFormatted
    ? `Uma nova tentativa de processamento sera realizada em <strong>${params.retryDateFormatted}</strong>.`
    : "Por favor, revise os dados do seu cartao para manter seu acesso sem interrupcoes.";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Ola, <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Identificamos uma instabilidade ao processar a cobranca da assinatura do seu <strong>${params.planName}</strong> junto a operadora do seu cartao.
    </p>
    <div style="background-color: #1F2937; border-left: 3px solid #EF4444; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #FCA5A5;">${retryInfo}</p>
    </div>
    <p style="margin: 0 0 16px 0;">
      Para evitar a suspensao das suas ferramentas financeiras, atualize a forma de pagamento clicando no botao abaixo:
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Atencao Necessaria",
    heading: "Pendencia de Pagamento",
    bodyHtml,
    ctaText: "Atualizar Forma de Pagamento",
    ctaUrl: params.updateCardUrl,
  });

  const text = `Ola, ${firstName}. Nao conseguimos processar o pagamento do ${params.planName}. Atualize seu cartao para evitar interrupcao no servico: ${params.updateCardUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 5. Template: Confirmacao de Cancelamento
// -----------------------------------------------------------------------------
export function renderSubscriptionCanceledEmail(params: {
  name: string;
  isCdcRefund: boolean;
  effectiveUntilFormatted?: string;
  reactivateUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] : "Cliente";
  const subject = "Confirmacao de cancelamento da assinatura Axir";

  const messageDetails = params.isCdcRefund
    ? `
      <p style="margin: 0 0 16px 0;">
        Como sua solicitacao ocorreu dentro do prazo legal de 7 dias (CDC), o <strong>estorno integral</strong> foi solicitado ao gateway financeiro e seu plano Pro foi encerrado. O credito dependera do fechamento da fatura do seu banco emissor.
      </p>
      <p style="margin: 0 0 16px 0;">
        Sua conta agora opera no modo <strong>Somente Leitura</strong>. Seus dados financeiros historicos permanecem salvos com total seguranca.
      </p>
    `
    : `
      <p style="margin: 0 0 16px 0;">
        Sua assinatura foi cancelada e nao havera novas cobrancas.
      </p>
      <p style="margin: 0 0 16px 0;">
        Seu acesso completo ao Plano Pro continuara ativo ate <strong>${params.effectiveUntilFormatted || "o fim do periodo atual"}</strong>. Apos essa data, sua conta passara automaticamente para o modo Somente Leitura.
      </p>
    `;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Ola, <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Confirmamos a realizacao do cancelamento da sua assinatura no <strong>Axir</strong>.
    </p>
    ${messageDetails}
    <p style="margin: 0 0 16px 0;">
      Sentiremos sua falta. Se desejar reativar sua assinatura no futuro, bastara acessar sua conta com seu login habitual.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Cancelamento Confirmado",
    heading: "Assinatura Cancelada",
    bodyHtml,
    ctaText: "Reativar Minha Assinatura",
    ctaUrl: params.reactivateUrl,
  });

  const text = `Ola, ${firstName}. Confirmamos o cancelamento da sua assinatura no Axir. Seus dados continuam preservados. Voce pode reativar quando quiser em: ${params.reactivateUrl}`;

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
  const firstName = params.name ? params.name.split(" ")[0] : "Cliente";
  const subject = `Seu teste gratuito no Axir termina em ${params.daysRemaining} dias`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Ola, <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Faltam apenas <strong>${params.daysRemaining} dias</strong> para o encerramento do seu periodo de testes gratuito no <strong>Axir</strong> (termino em <strong>${params.trialEndsFormatted}</strong>).
    </p>
    <p style="margin: 0 0 16px 0;">
      Para manter suas sincronizacoes ativas, motores de projecao e continuar lancando novas despesas sem interrupcao, escolha o plano ideal para seus objetivos patrimoniais.
    </p>
    <div style="background-color: #1F2937; border-left: 3px solid #0D9488; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0 0 4px 0; font-size: 13px; color: #D1D5DB;">Plano Pro Mensal: R$ 19,99/mes</p>
      <p style="margin: 0; font-size: 13px; color: #D1D5DB;">Plano Pro Anual: R$ 143,88/ano (equivalente a R$ 11,99/mes - 40% de economia)</p>
    </div>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Periodo de Teste Expirando",
    heading: "Nao perca o ritmo da sua gestao",
    bodyHtml,
    ctaText: "Garantir Meu Plano Pro",
    ctaUrl: params.checkoutUrl,
  });

  const text = `Ola, ${firstName}. Faltam ${params.daysRemaining} dias para o fim do seu teste gratuito no Axir (ate ${params.trialEndsFormatted}). Garanta seu plano Pro em: ${params.checkoutUrl}`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// 7. Template: Encerramento do trial e transicao para Somente Leitura
// -----------------------------------------------------------------------------
export function renderTrialExpiredReadOnlyEmail(params: {
  name: string;
  reactivateUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] : "Cliente";
  const subject = "Seu periodo de testes no Axir terminou";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Ola, <strong>${firstName}</strong>,</p>
    <p style="margin: 0 0 16px 0;">
      Seu periodo de testes de 30 dias no <strong>Axir</strong> chegou ao fim.
    </p>
    <p style="margin: 0 0 16px 0;">
      Sua conta passou para o modo <strong>Somente Leitura</strong>. Todos os seus dados, contas bancarias, metas e historico continuam <strong>100% seguros e intactos</strong> para consulta e exportacao.
    </p>
    <p style="margin: 0 0 16px 0;">
      Para voltar a cadastrar novas transacoes, sincronizar cartoes e utilizar o motor de projecao, assine o Plano Pro a qualquer momento.
    </p>
  `;

  const html = renderAxirEmailShell({
    title: subject,
    badge: "Modo Somente Leitura",
    heading: "Seus dados continuam seguros",
    bodyHtml,
    ctaText: "Reativar Plano Pro",
    ctaUrl: params.reactivateUrl,
  });

  const text = `Ola, ${firstName}. Seu teste gratuito no Axir terminou. Sua conta esta em modo Somente Leitura e todos os seus dados estao salvos. Reative o Pro em: ${params.reactivateUrl}`;

  return { subject, html, text };
}
