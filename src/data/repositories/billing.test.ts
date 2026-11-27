import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createCheckoutSession,
  createCumulativeCheckoutSession,
  cancelSubscription,
  updateSubscriptionCreditCard,
  updatePaymentMethod,
  schedulePlanChange,
  cancelScheduledPlanChange,
  getBillingAdapter,
  getMyBillingContact,
  asaasBillingAdapter,
} from "./billing";

const mockInvoke = vi.fn();
const mockGetMyBillingContactRpc = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

vi.mock("@/data/rpc", () => ({
  getMyBillingContact: (...args: unknown[]) => mockGetMyBillingContactRpc(...args),
}));

describe("Billing Repository (Asaas Adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolve adaptador Asaas via getBillingAdapter", () => {
    expect(getBillingAdapter()).toBe(asaasBillingAdapter);
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

  it("chama asaas-checkout para pagamento acumulativo", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        method: "pix",
        paymentId: "pay-cumul-123",
        copyPasteKey: "000201-pix-copia",
        qrCodeBase64: "base64-cumul",
        expirationDate: "2026-10-15T12:00:00Z",
      },
      error: null,
    });

    const res = await createCumulativeCheckoutSession({
      months: 3,
      method: "pix",
    });

    expect(mockInvoke).toHaveBeenCalledWith("asaas-checkout", {
      body: expect.objectContaining({
        kind: "cumulative_months",
        months: 3,
        method: "pix",
      }),
    });
    expect(res.ok).toBe(true);
    expect((res as { copyPasteKey: string }).copyPasteKey).toBe("000201-pix-copia");
  });

  it("chama asaas-manage com action schedule-plan-change", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, message: "Migração para o plano pro_annual agendada" },
      error: null,
    });

    const res = await schedulePlanChange("annual");

    expect(mockInvoke).toHaveBeenCalledWith("asaas-manage", {
      body: {
        action: "schedule-plan-change",
        targetPlan: "annual",
      },
    });
    expect(res.ok).toBe(true);
  });

  it("extrai mensagem real de erro do corpo JSON quando Edge Function retorna não-2xx", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "Por favor, confirme seu endereço de e-mail antes de contratar uma assinatura.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      },
    });

    await expect(
      createCumulativeCheckoutSession({
        months: 1,
        method: "pix",
      }),
    ).rejects.toThrow("Por favor, confirme seu endereço de e-mail antes de contratar uma assinatura.");
  });

  it("aceita resposta trial_scheduled do asaas-checkout sem tier e status", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        method: "credit_card",
        phase: "trial_scheduled",
        subscriptionId: "sub_trial_123",
        firstChargeAt: "2026-12-27T00:00:00.000Z",
        email: "teste@exemplo.com",
        cardLast4: "4242",
      },
      error: null,
    });

    const res = await createCheckoutSession({
      plan: "monthly",
      method: "credit_card",
      customer: { name: "Gabriel", email: "teste@exemplo.com", cpf: "12345678909" },
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("credit_card");
    expect((res as { phase?: string }).phase).toBe("trial_scheduled");
  });

  it("chama asaas-manage com action cancel-plan-change", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, message: "Agendamento cancelado com sucesso." },
      error: null,
    });

    const res = await cancelScheduledPlanChange();

    expect(mockInvoke).toHaveBeenCalledWith("asaas-manage", {
      body: {
        action: "cancel-scheduled-plan-change",
      },
    });
    expect(res.ok).toBe(true);
  });

  it("extrai mensagem real de erro do corpo JSON quando Edge Function retorna não-2xx", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "Por favor, confirme seu endereço de e-mail antes de contratar uma assinatura.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      },
    });

    await expect(
      createCumulativeCheckoutSession({
        months: 1,
        method: "pix",
      }),
    ).rejects.toThrow("Por favor, confirme seu endereço de e-mail antes de contratar uma assinatura.");
  });

  it("aceita resposta trial_scheduled do asaas-checkout sem tier e status", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: true,
        method: "credit_card",
        phase: "trial_scheduled",
        subscriptionId: "sub_trial_123",
        firstChargeAt: "2026-12-27T00:00:00.000Z",
        email: "teste@exemplo.com",
        cardLast4: "4242",
      },
      error: null,
    });

    const res = await createCheckoutSession({
      plan: "monthly",
      method: "credit_card",
      customer: { name: "Gabriel", email: "teste@exemplo.com", cpf: "12345678909" },
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("credit_card");
    expect((res as { phase?: string }).phase).toBe("trial_scheduled");
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

  it("atualiza forma de pagamento via updatePaymentMethod", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, message: "Cartão atualizado" },
      error: null,
    });

    await updatePaymentMethod({
      subscriptionId: "sub_123",
      card: {
        holderName: "OUTRO NOME",
        number: "4111111111111111",
        expiryMonth: "10",
        expiryYear: "31",
        ccv: "999",
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith("asaas-manage", {
      body: {
        action: "update-card",
        card: expect.objectContaining({
          holderName: "OUTRO NOME",
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

  it("envia phone, postalCode e addressNumber na raiz e no card em createCheckoutSession e updatePaymentMethod", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, method: "credit_card", subscriptionId: "sub-999", tier: "pro_annual", status: "active" },
      error: null,
    });

    await createCheckoutSession({
      plan: "annual",
      method: "credit_card",
      customer: {
        name: "MARIA SILVA",
        email: "maria@exemplo.com",
        cpf: "12345678909",
        phone: "(11) 98765-4321",
        postalCode: "01310-100",
        addressNumber: "1000",
      },
      card: {
        holderName: "MARIA SILVA",
        number: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "28",
        ccv: "123",
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith("asaas-checkout", {
      body: expect.objectContaining({
        phone: "11987654321",
        postalCode: "01310100",
        addressNumber: "1000",
        card: expect.objectContaining({
          phone: "11987654321",
          postalCode: "01310100",
          addressNumber: "1000",
        }),
      }),
    });

    await updatePaymentMethod({
      subscriptionId: "sub_999",
      card: {
        holderName: "MARIA SILVA",
        number: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "28",
        ccv: "123",
        phone: "(11) 98765-4321",
        postalCode: "01310-100",
        addressNumber: " 500 ",
      },
    });

    expect(mockInvoke).toHaveBeenLastCalledWith("asaas-manage", {
      body: {
        action: "update-card",
        card: expect.objectContaining({
          phone: "11987654321",
          postalCode: "01310100",
          addressNumber: "500",
        }),
      },
    });
  });

  it("mapeia corretamente getMyBillingContact a partir da RPC segura (D-02)", async () => {
    mockGetMyBillingContactRpc.mockResolvedValueOnce({
      name: "Maria Silva",
      email: "maria@exemplo.com",
      cpf: "12345678909",
      masked_cpf: "***.***.789-**",
      phone: "11987654321",
      postal_code: "01310100",
      address_number: "1000",
    });

    const contact = await getMyBillingContact();
    expect(contact).toEqual({
      name: "Maria Silva",
      email: "maria@exemplo.com",
      cpf: "12345678909",
      maskedCpf: "***.***.789-**",
      phone: "11987654321",
      postalCode: "01310100",
      addressNumber: "1000",
    });
  });
});
