import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createCheckoutSession,
  cancelSubscription,
  updateSubscriptionCreditCard,
  updatePaymentMethod,
  getBillingPortalUrl,
  getBillingAdapter,
  stripeBillingAdapter,
  asaasBillingAdapter,
} from "./billing";

const mockInvoke = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

describe("Billing Repository (Asaas Adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama asaas-checkout com dados de cartão e retorna sucesso", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, method: "credit_card", subscriptionId: "sub-123", tier: "pro_annual" },
      error: null,
    });

    const res = await createCheckoutSession({
      plan: "annual",
      method: "credit_card",
      cpf: "12345678909",
      card: {
        holderName: "FULANO DE TAL",
        number: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "28",
        ccv: "123",
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith("asaas-checkout", {
      body: expect.objectContaining({
        plan: "annual",
        method: "credit_card",
        cpf: "12345678909",
      }),
    });
    expect(res.ok).toBe(true);
    expect((res as { subscriptionId: string }).subscriptionId).toBe("sub-123");
    expect(res.provider).toBe("asaas");
  });

  it("chama asaas-checkout para PIX anual e retorna QR Code", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        method: "pix",
        paymentId: "pay-123",
        qrCodeBase64: "base64qr",
        copyPasteKey: "000201...",
        expirationDate: "2026-10-15",
      },
      error: null,
    });

    const res = await createCheckoutSession({
      plan: "annual",
      method: "pix",
      cpf: "12345678909",
    });

    expect(mockInvoke).toHaveBeenCalledWith("asaas-checkout", {
      body: expect.objectContaining({
        plan: "annual",
        method: "pix",
      }),
    });
    expect(res.ok).toBe(true);
    expect((res as { copyPasteKey: string }).copyPasteKey).toBe("000201...");
  });

  it("chama asaas-manage com action cancel", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, message: "Assinatura cancelada com sucesso" },
      error: null,
    });

    await cancelSubscription();

    expect(mockInvoke).toHaveBeenCalledWith("asaas-manage", {
      body: { action: "cancel" },
    });
  });

  it("chama asaas-manage com action update-card", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, message: "Cartão atualizado com sucesso" },
      error: null,
    });

    await updateSubscriptionCreditCard({
      holderName: "NOVO NOME",
      number: "5555444433332222",
      expiryMonth: "05",
      expiryYear: "30",
      ccv: "456",
    });

    expect(mockInvoke).toHaveBeenCalledWith("asaas-manage", {
      body: {
        action: "update-card",
        card: expect.objectContaining({
          holderName: "NOVO NOME",
        }),
      },
    });
  });

  it("lança AppError quando a função Asaas retorna erro", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: "Cartão recusado pelo banco emissor" },
      error: null,
    });

    await expect(
      createCheckoutSession({
        plan: "annual",
        method: "pix",
        cpf: "12345678909",
      }),
    ).rejects.toThrow("Cartão recusado pelo banco emissor");
  });
});

describe("Billing Repository (Stripe Adapter & Multi-Provider)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolve adaptadores corretos via getBillingAdapter", () => {
    expect(getBillingAdapter("stripe")).toBe(stripeBillingAdapter);
    expect(getBillingAdapter("asaas")).toBe(asaasBillingAdapter);
    expect(getBillingAdapter()).toBe(asaasBillingAdapter);
  });

  it("inicia checkout de sessão hospedada via Stripe", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        sessionId: "cs_test_123",
      },
      error: null,
    });

    const res = await createCheckoutSession(
      {
        plan: "monthly",
        method: "hosted_session",
        customer: {
          name: "Cliente Global",
          email: "cliente@example.com",
          cpf: "12345678909",
        },
      },
      "stripe",
    );

    expect(mockInvoke).toHaveBeenCalledWith("stripe-checkout", {
      body: expect.objectContaining({
        plan: "monthly",
        method: "hosted_session",
      }),
    });
    expect(res.ok).toBe(true);
    expect(res.provider).toBe("stripe");
    expect((res as { checkoutUrl: string }).checkoutUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
  });

  it("cancela assinatura no Stripe via stripe-manage", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    });

    await cancelSubscription({ subscriptionId: "sub_stripe_123", immediate: true }, "stripe");

    expect(mockInvoke).toHaveBeenCalledWith("stripe-manage", {
      body: {
        action: "cancel",
        subscriptionId: "sub_stripe_123",
        immediate: true,
      },
    });
  });

  it("atualiza forma de pagamento no Stripe via updatePaymentMethod", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    });

    await updatePaymentMethod(
      {
        subscriptionId: "sub_stripe_123",
        card: {
          holderName: "TITULAR STRIPE",
          number: "4242424242424242",
          expiryMonth: "10",
          expiryYear: "29",
          ccv: "999",
        },
      },
      "stripe",
    );

    expect(mockInvoke).toHaveBeenCalledWith("stripe-manage", {
      body: expect.objectContaining({
        action: "update-payment-method",
        subscriptionId: "sub_stripe_123",
      }),
    });
  });

  it("obtém URL do Stripe Customer Portal com sucesso", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { portalUrl: "https://billing.stripe.com/p/session/test_123" },
      error: null,
    });

    const portalUrl = await getBillingPortalUrl("cus_test_123", undefined, "stripe");

    expect(mockInvoke).toHaveBeenCalledWith("stripe-manage", {
      body: expect.objectContaining({
        action: "portal",
        customerId: "cus_test_123",
      }),
    });
    expect(portalUrl).toBe("https://billing.stripe.com/p/session/test_123");
  });

  it("lança AppError quando provedor não suporta portal de faturamento", async () => {
    await expect(getBillingPortalUrl("cus_123", undefined, "asaas")).rejects.toThrow(
      "O provedor atual não possui portal de autoatendimento hospedado.",
    );
  });
});
