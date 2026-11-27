import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasPeriodEndAdvanced, useCumulativeRenewal } from "./use-cumulative-renewal";

const mutateAsyncMock = vi.fn();
const cancelPixMock = vi.fn();
const pushToastMock = vi.fn();

vi.mock("@/state", () => ({
  USER_SUBSCRIPTION_KEY: ["user-subscription"],
  INVOICES_KEY: ["invoices"],
  useCumulativeCheckoutMutation: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useCancelPendingPixMutation: () => ({
    mutateAsync: cancelPixMock,
    isPending: false,
  }),
}));

vi.mock("@/services/toast", () => ({
  pushToast: (...args: unknown[]) => pushToastMock(...args),
}));

describe("useCumulativeRenewal (A-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelPixMock.mockResolvedValue({ ok: true, canceledCount: 1, message: "Cancelado" });
  });

  it("hasPeriodEndAdvanced detecta extensão real da data de vencimento", () => {
    expect(hasPeriodEndAdvanced("2026-12-24T00:00:00Z", "2026-12-24T00:00:00Z")).toBe(false);
    expect(hasPeriodEndAdvanced("2026-12-24T00:00:00Z", "2027-03-24T00:00:00Z")).toBe(true);
  });

  it("fecha automaticamente o modal PIX e exibe confirmação quando currentPeriodEnd avança", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    mutateAsyncMock.mockResolvedValueOnce({
      ok: true,
      method: "pix",
      paymentId: "pay-1",
      qrCodeBase64: "abc",
      copyPasteKey: "000201",
      expirationDate: "2026-11-24T19:00:00Z",
    });

    const { result, rerender } = renderHook(
      ({ periodEnd }: { periodEnd: string | null }) => useCumulativeRenewal(periodEnd),
      {
        wrapper,
        initialProps: { periodEnd: "2026-12-24T00:00:00Z" },
      },
    );

    await act(async () => {
      await result.current.handleGeneratePix();
    });

    expect(result.current.pixModalOpen).toBe(true);

    rerender({ periodEnd: "2027-03-24T00:00:00Z" });

    expect(result.current.pixModalOpen).toBe(false);
    expect(pushToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Antecipação confirmada!",
        variant: "success",
      }),
    );
  });

  it("handleCancelPix cancela a cobrança pelo paymentId e fecha o modal PIX", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    mutateAsyncMock.mockResolvedValueOnce({
      ok: true,
      method: "pix",
      paymentId: "pay-cancel-99",
      qrCodeBase64: "abc",
      copyPasteKey: "000201",
      expirationDate: "2026-11-27T19:00:00Z",
    });

    const { result } = renderHook(
      ({ periodEnd }: { periodEnd: string | null }) => useCumulativeRenewal(periodEnd),
      {
        wrapper,
        initialProps: { periodEnd: "2026-12-24T00:00:00Z" },
      },
    );

    await act(async () => {
      await result.current.handleGeneratePix();
    });

    expect(result.current.pixModalOpen).toBe(true);

    await act(async () => {
      await result.current.handleCancelPix();
    });

    expect(cancelPixMock).toHaveBeenCalledWith({ paymentId: "pay-cancel-99" });
    expect(result.current.pixModalOpen).toBe(false);
    expect(result.current.pixData).toBeNull();
  });
});
