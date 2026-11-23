import { describe, expect, it } from "vitest";
import {
  renderAxirEmailShell,
  renderTrialWelcomeEmail,
  renderTrialCardScheduledEmail,
  renderProActivationEmail,
  renderProPlanChangeScheduledEmail,
  renderPaymentFailedEmail,
  renderSubscriptionCanceledEmail,
  renderTrialEndingReminderEmail,
  renderTrialExpiredReadOnlyEmail,
  renderSundayDigestEmail,
} from "../../supabase/functions/_shared/email-templates.ts";

// Regex idêntica à regra ESLint local/no-decorative-unicode
const FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}✓✔✕✖▲▼●◆■★☆]/u;

function assertCleanBrandAndNoEmoji(textOrHtml: string) {
  expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(textOrHtml)).toBe(false);
  expect(textOrHtml).not.toMatch(/Áxis|Axis Finance|AXIR FINANCE/i);
  expect(textOrHtml).not.toContain("#0B0F19"); // Fundo escuro antigo proibido
  expect(textOrHtml).not.toContain("#111827"); // Card escuro antigo proibido
}

describe("Templates de E-mail Transacionais Axir (Arquitetura Dual Editorial Light: Teal vs Ouro Âmbar PRO)", () => {
  it("renderAxirEmailShell (variante padrão 'teal') usa tokens Light-First, logo Teal e não exibe badge PRO no cabeçalho", () => {
    const html = renderAxirEmailShell({
      title: "Teste Shell Teal",
      badge: "Notificação",
      heading: "Título Principal",
      bodyHtml: "<p>Conteúdo de teste</p>",
      ctaText: "Acessar Plataforma",
      ctaUrl: "https://axir.com.br/painel",
    });

    expect(html).toContain("Axir");
    expect(html).toContain("#F4F7F9"); // Canvas Light oficial
    expect(html).toContain("#FFFFFF"); // Card Surface Light oficial
    expect(html).toContain("#142531"); // Foreground Azul Petróleo Profundo
    expect(html).toContain("#2A9D8F"); // Filete Teal Vital
    expect(html).toContain("#1B6B62"); // Botão Teal Strong
    expect(html).toContain("https://axir.com.br/brand/logo-teal-light-128.png");
    expect(html).not.toContain("logo-amber-light-128.png");
    expect(html).toContain("Acessar Plataforma");
    expect(html).toContain("https://axir.com.br/painel");
    assertCleanBrandAndNoEmoji(html);
  });

  it("renderAxirEmailShell (variante 'pro') usa logo dourada Axir PRO, pill PRO e paleta Ouro Âmbar", () => {
    const html = renderAxirEmailShell({
      title: "Teste Shell PRO",
      badge: "Membro PRO",
      heading: "Título PRO",
      bodyHtml: "<p>Conteúdo exclusivo PRO</p>",
      ctaText: "Acessar Painel PRO",
      ctaUrl: "https://axir.com.br/painel",
      themeVariant: "pro",
    });

    expect(html).toContain("https://axir.com.br/brand/logo-amber-light-128.png");
    expect(html).not.toContain("logo-teal-light-128.png");
    expect(html).toContain("#DDA726"); // Filete e acento Ouro Âmbar
    expect(html).toContain("#92400E"); // Texto Âmbar forte AA
    expect(html).toContain("PRO");
    assertCleanBrandAndNoEmoji(html);
  });

  it("Template 1 (TEAL): renderTrialWelcomeEmail renderiza identidade Teal para usuário em período de teste", () => {
    const res = renderTrialWelcomeEmail({
      name: "Gabriel Sales",
      trialDays: 30,
      trialEndsFormatted: "18/12/2026",
      appUrl: "https://axir.com.br",
    });

    expect(res.subject).toContain("Bem-vindo ao Axir");
    expect(res.subject).toContain("30 dias");
    expect(res.html).toContain("Gabriel");
    expect(res.html).toContain("18/12/2026");
    expect(res.html).toContain("logo-teal-light-128.png");
    expect(res.html).not.toContain("logo-amber-light-128.png");
    assertCleanBrandAndNoEmoji(res.subject);
    assertCleanBrandAndNoEmoji(res.html);
    assertCleanBrandAndNoEmoji(res.text);
  });

  it("Template 2 (TEAL): renderTrialCardScheduledEmail renderiza agendamento no Trial com tema Teal e sem cobrança hoje", () => {
    const res = renderTrialCardScheduledEmail({
      name: "Mariana Costa",
      cardLast4: "4242",
      firstChargeDateFormatted: "05/12/2026",
      planName: "Plano Pro Mensal",
      planValueFormatted: "R$ 19,99",
      appUrl: "https://axir.com.br",
    });

    expect(res.subject).toContain("Cartão validado no Axir");
    expect(res.html).toContain("4242");
    expect(res.html).toContain("Plano Pro Mensal");
    expect(res.html).toContain("R$ 19,99");
    expect(res.html).toContain("05/12/2026");
    expect(res.html).toContain("Nenhum valor foi cobrado hoje");
    expect(res.html).toContain("logo-teal-light-128.png");
    expect(res.html).not.toContain("logo-amber-light-128.png");
    assertCleanBrandAndNoEmoji(res.subject);
    assertCleanBrandAndNoEmoji(res.html);
  });

  it("Template 3 (PRO): renderProActivationEmail na 1ª ativação exibe logo PRO, Ouro Âmbar e carta calorosa de co-criação/sugestões", () => {
    const res = renderProActivationEmail({
      name: "Carlos Eduardo",
      planName: "Plano Pro Anual",
      periodEndFormatted: "18/11/2027",
      invoiceValueFormatted: "R$ 143,88",
      invoicePdfUrl: "https://asaas.com/i/sample123",
      appUrl: "https://axir.com.br",
      isFirstActivation: true,
    });

    expect(res.subject).toContain("Boas-vindas ao Axir PRO");
    expect(res.html).toContain("logo-amber-light-128.png");
    expect(res.html).not.toContain("logo-teal-light-128.png");
    expect(res.html).toContain("#DDA726");
    expect(res.html).toContain("Plano Pro Anual");
    expect(res.html).toContain("R$ 143,88");
    expect(res.html).toContain("18/11/2027");
    expect(res.html).toContain("https://asaas.com/i/sample123");
    // Verifica a presença da carta de boas-vindas, pertencimento e canal aberto de sugestões/críticas
    expect(res.html).toContain("este aplicativo é verdadeiramente seu");
    expect(res.html).toContain("sugestão, pedido ou crítica construtiva");
    expect(res.html).toContain("próximas atualizações");
    assertCleanBrandAndNoEmoji(res.subject);
    assertCleanBrandAndNoEmoji(res.html);
    assertCleanBrandAndNoEmoji(res.text);
  });

  it("Template 3b (PRO): renderProActivationEmail em renovação ou antecipação acumulativa mantém identidade PRO", () => {
    const res = renderProActivationEmail({
      name: "Carlos Eduardo",
      planName: "Plano Pro Mensal",
      periodEndFormatted: "18/05/2027",
      invoiceValueFormatted: "R$ 59,97",
      appUrl: "https://axir.com.br",
      isFirstActivation: false,
      cumulativeMonths: 3,
    });

    expect(res.subject).toContain("+3 meses");
    expect(res.html).toContain("logo-amber-light-128.png");
    expect(res.html).toContain("+3 meses somados integralmente");
    expect(res.html).toContain("Canal direto do assinante PRO");
    assertCleanBrandAndNoEmoji(res.html);
  });

  it("Template 4 (PRO): renderProPlanChangeScheduledEmail usa identidade Ouro Âmbar PRO", () => {
    const res = renderProPlanChangeScheduledEmail({
      name: "Fernanda Lima",
      currentPlanName: "Plano Pro Mensal",
      targetPlanName: "Plano Pro Anual",
      targetPlanValueFormatted: "R$ 143,88/ano",
      effectiveDateFormatted: "20/12/2026",
      appUrl: "https://axir.com.br",
    });

    expect(res.subject).toContain("Axir PRO");
    expect(res.html).toContain("logo-amber-light-128.png");
    expect(res.html).toContain("20/12/2026");
    assertCleanBrandAndNoEmoji(res.html);
  });

  it("Template 5 (PRO + Alerta): renderPaymentFailedEmail mantém logo PRO no cabeçalho com callout Coral Suave", () => {
    const res = renderPaymentFailedEmail({
      name: "Ana Julia",
      planName: "Plano Pro Mensal",
      updateCardUrl: "https://axir.com.br/assinatura",
    });

    expect(res.subject).toContain("não conseguimos processar");
    expect(res.html).toContain("Ana");
    expect(res.html).toContain("logo-amber-light-128.png");
    expect(res.html).toContain("#FEF2F2");
    expect(res.html).toContain("https://axir.com.br/assinatura");
    assertCleanBrandAndNoEmoji(res.subject);
    assertCleanBrandAndNoEmoji(res.html);
  });

  it("Template 6: renderSubscriptionCanceledEmail usa Teal no estorno imediato CDC e PRO quando mantém vigência até o fim do período", () => {
    const resCdc = renderSubscriptionCanceledEmail({
      name: "Lucas Silva",
      isCdcRefund: true,
      reactivateUrl: "https://axir.com.br/assinatura",
    });
    expect(resCdc.html).toContain("Estorno Integral Solicitado");
    expect(resCdc.html).toContain("Somente Leitura");
    expect(resCdc.html).toContain("logo-teal-light-128.png");

    const resEndPeriod = renderSubscriptionCanceledEmail({
      name: "Lucas Silva",
      isCdcRefund: false,
      effectiveUntilFormatted: "15/01/2027",
      reactivateUrl: "https://axir.com.br/assinatura",
    });
    expect(resEndPeriod.html).toContain("15/01/2027");
    expect(resEndPeriod.html).toContain("logo-amber-light-128.png");

    assertCleanBrandAndNoEmoji(resCdc.html);
    assertCleanBrandAndNoEmoji(resEndPeriod.html);
  });

  it("Template 7 (TEAL): renderTrialEndingReminderEmail usa identidade Teal para usuário em Trial", () => {
    const res = renderTrialEndingReminderEmail({
      name: "Beatriz Ramos",
      daysRemaining: 3,
      trialEndsFormatted: "21/11/2026",
      checkoutUrl: "https://axir.com.br/assinatura",
    });

    expect(res.subject).toContain("termina em 3 dias");
    expect(res.html).toContain("3 dias");
    expect(res.html).toContain("21/11/2026");
    expect(res.html).toContain("logo-teal-light-128.png");
    expect(res.html).not.toContain("logo-amber-light-128.png");
    assertCleanBrandAndNoEmoji(res.subject);
    assertCleanBrandAndNoEmoji(res.html);
  });

  it("Template 8 (TEAL): renderTrialExpiredReadOnlyEmail usa identidade Teal ao migrar para Somente Leitura", () => {
    const res = renderTrialExpiredReadOnlyEmail({
      name: "Marcos Vinicius",
      reactivateUrl: "https://axir.com.br/assinatura",
    });

    expect(res.subject).toContain("Seu período de testes no Axir terminou");
    expect(res.html).toContain("Somente Leitura");
    expect(res.html).toContain("100% salvos e intactos");
    expect(res.html).toContain("logo-teal-light-128.png");
    expect(res.html).not.toContain("logo-amber-light-128.png");
    assertCleanBrandAndNoEmoji(res.subject);
    assertCleanBrandAndNoEmoji(res.html);
  });

  it("Template 9 (ADAPTATIVO): renderSundayDigestEmail alterna entre Teal (Trial) e Ouro Âmbar PRO (Assinante)", () => {
    const trialDigest = renderSundayDigestEmail({
      name: "Rafael",
      periodLabel: "10/11 a 16/11",
      totalWeeklySpentBRL: "R$ 450,00",
      expenseCount: 5,
      topCategoryName: "Alimentação",
      topCategorySpentBRL: "R$ 220,00",
      upcomingCount: 1,
      upcomingTotalBRL: "R$ 120,00",
      appUrl: "https://axir.com.br",
      managePrefsUrl: "https://axir.com.br/configuracoes?tab=notifications",
      isPro: false,
    });
    expect(trialDigest.subject).toBe("Resumo da Semana Axir (10/11 a 16/11)");
    expect(trialDigest.html).toContain("logo-teal-light-128.png");
    expect(trialDigest.html).not.toContain("logo-amber-light-128.png");
    assertCleanBrandAndNoEmoji(trialDigest.html);

    const proDigest = renderSundayDigestEmail({
      name: "Rafael",
      periodLabel: "10/11 a 16/11",
      totalWeeklySpentBRL: "R$ 450,00",
      expenseCount: 5,
      topCategoryName: "Alimentação",
      topCategorySpentBRL: "R$ 220,00",
      upcomingCount: 1,
      upcomingTotalBRL: "R$ 120,00",
      appUrl: "https://axir.com.br",
      managePrefsUrl: "https://axir.com.br/configuracoes?tab=notifications",
      isPro: true,
    });
    expect(proDigest.subject).toBe("Resumo da Semana Axir PRO (10/11 a 16/11)");
    expect(proDigest.html).toContain("logo-amber-light-128.png");
    expect(proDigest.html).not.toContain("logo-teal-light-128.png");
    expect(proDigest.html).toContain("#DDA726");
    assertCleanBrandAndNoEmoji(proDigest.html);
  });
});
