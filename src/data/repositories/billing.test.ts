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
});
