import { describe, expect, it } from "vitest";
import {
  renderAxirEmailShell,
  renderTrialWelcomeEmail,
  renderTrialCardScheduledEmail,
  renderProActivationEmail,
  renderPaymentFailedEmail,
  renderSubscriptionCanceledEmail,
  renderTrialEndingReminderEmail,
  renderTrialExpiredReadOnlyEmail,
} from "../../supabase/functions/_shared/email-templates.ts";

// Regex idêntica à regra ESLint local/no-decorative-unicode
const FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}✓✔✕✖▲▼●◆■★☆]/u;

describe("Templates de E-mail Transacionais Axir (Fase 3 - Qualidade e Integridade)", () => {
  it("renderAxirEmailShell produz HTML estrutural com tokens canônicos do Design System", () => {
    const html = renderAxirEmailShell({
      title: "Teste Shell",
      badge: "Notificação",
      heading: "Título Principal",
      bodyHtml: "<p>Conteúdo de teste</p>",
      ctaText: "Acessar Plataforma",
      ctaUrl: "https://axir.com.br/painel",
    });

    expect(html).toContain("AXIR");
    expect(html).toContain("FINANCE");
    expect(html).toContain("#0B0F19"); // Canvas Dark
    expect(html).toContain("#111827"); // Card Surface
    expect(html).toContain("#0D9488"); // Teal Accent
    expect(html).toContain("Acessar Plataforma");
    expect(html).toContain("https://axir.com.br/painel");
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(html)).toBe(false);
  });

  it("Template 1: renderTrialWelcomeEmail renderiza sem emojis e com dados corretos", () => {
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
    expect(res.html).toContain("https://axir.com.br");
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.subject)).toBe(false);
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.html)).toBe(false);
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.text)).toBe(false);
  });

  it("Template 2: renderTrialCardScheduledEmail renderiza dados de agendamento sem cobrança imediata", () => {
    const res = renderTrialCardScheduledEmail({
      name: "Mariana Costa",
      cardLast4: "4242",
      firstChargeDateFormatted: "05/12/2026",
      planName: "Plano Pro Mensal",
      planValueFormatted: "R$ 19,99",
      appUrl: "https://axir.com.br",
    });

    expect(res.subject).toContain("Cartão cadastrado");
    expect(res.html).toContain("4242");
    expect(res.html).toContain("Plano Pro Mensal");
    expect(res.html).toContain("R$ 19,99");
    expect(res.html).toContain("05/12/2026");
    expect(res.html).toContain("Nenhum valor foi debitado hoje");
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.subject)).toBe(false);
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.html)).toBe(false);
  });

  it("Template 3: renderProActivationEmail renderiza confirmação de pagamento e vigência", () => {
    const res = renderProActivationEmail({
      name: "Carlos Eduardo",
      planName: "Plano Pro Anual",
      periodEndFormatted: "18/11/2027",
      invoiceValueFormatted: "R$ 143,88",
      invoicePdfUrl: "https://asaas.com/i/sample123",
      appUrl: "https://axir.com.br",
    });

    expect(res.subject).toContain("Confirmação de Pagamento");
    expect(res.html).toContain("Plano Pro Anual");
    expect(res.html).toContain("R$ 143,88");
    expect(res.html).toContain("18/11/2027");
    expect(res.html).toContain("https://asaas.com/i/sample123");
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.subject)).toBe(false);
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.html)).toBe(false);
  });

  it("Template 4: renderPaymentFailedEmail renderiza aviso de falha e link de correção", () => {
    const res = renderPaymentFailedEmail({
      name: "Ana Julia",
      planName: "Plano Pro Mensal",
      updateCardUrl: "https://axir.com.br/assinatura",
    });

    expect(res.subject).toContain("não conseguimos processar");
    expect(res.html).toContain("Ana");
    expect(res.html).toContain("https://axir.com.br/assinatura");
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.subject)).toBe(false);
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.html)).toBe(false);
  });

  it("Template 5: renderSubscriptionCanceledEmail diferencia CDC vs Cancelamento ao fim de período", () => {
    const resCdc = renderSubscriptionCanceledEmail({
      name: "Lucas Silva",
      isCdcRefund: true,
      reactivateUrl: "https://axir.com.br/assinatura",
    });
    expect(resCdc.html).toContain("estorno integral");
    expect(resCdc.html).toContain("Somente Leitura");

    const resEndPeriod = renderSubscriptionCanceledEmail({
      name: "Lucas Silva",
      isCdcRefund: false,
      effectiveUntilFormatted: "15/01/2027",
      reactivateUrl: "https://axir.com.br/assinatura",
    });
    expect(resEndPeriod.html).toContain("15/01/2027");
    expect(resEndPeriod.html).not.toContain("estorno integral");

    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(resCdc.html)).toBe(false);
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(resEndPeriod.html)).toBe(false);
  });

  it("Template 6: renderTrialEndingReminderEmail renderiza contagem regressiva de 3 dias", () => {
    const res = renderTrialEndingReminderEmail({
      name: "Beatriz Ramos",
      daysRemaining: 3,
      trialEndsFormatted: "21/11/2026",
      checkoutUrl: "https://axir.com.br/assinatura",
    });

    expect(res.subject).toContain("termina em 3 dias");
    expect(res.html).toContain("3 dias");
    expect(res.html).toContain("21/11/2026");
    expect(res.html).toContain("Plano Pro Mensal");
    expect(res.html).toContain("Plano Pro Anual");
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.subject)).toBe(false);
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.html)).toBe(false);
  });

  it("Template 7: renderTrialExpiredReadOnlyEmail renderiza comunicação de modo Somente Leitura", () => {
    const res = renderTrialExpiredReadOnlyEmail({
      name: "Marcos Vinicius",
      reactivateUrl: "https://axir.com.br/assinatura",
    });

    expect(res.subject).toContain("Seu período de testes no Axir terminou");
    expect(res.html).toContain("Somente Leitura");
    expect(res.html).toContain("100% salvos e intactos");
    expect(res.html).toContain("Seus dados continuam seguros");
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.subject)).toBe(false);
    expect(FORBIDDEN_EMOJI_OR_DECORATIVE_REGEX.test(res.html)).toBe(false);
  });
});
