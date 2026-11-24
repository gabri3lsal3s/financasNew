import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_SUBSCRIPTION_KEY } from "@/state/queries/use-user-access";
import { INVOICES_KEY } from "@/state/queries/use-invoices";
import {
  useCheckoutMutation,
  useUpdateSubscriptionCardMutation,
} from "./use-billing-mutations";

const createCheckoutSessionMock = vi.fn();
const updateSubscriptionCreditCardMock = vi.fn();

vi.mock("@/data/repositories/billing", () => ({
  cancelSubscription: vi.fn(),
  createCheckoutSession: (...args: unknown[]) => createCheckoutSessionMock(...args),
  createCumulativeCheckoutSession: vi.fn(),
  schedulePlanChange: vi.fn(),
  cancelScheduledPlanChange: vi.fn(),
  updateSubscriptionCreditCard: (...args: unknown[]) =>
    updateSubscriptionCreditCardMock(...args),
}));

describe("state/mutations/use-billing-mutations (A-10 & D-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it("invalida USER_SUBSCRIPTION_KEY quando phase === 'trial_scheduled' (A-10)", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    createCheckoutSessionMock.mockResolvedValueOnce({
      ok: true,
      method: "credit_card",
      provider: "asaas",
      tier: "trial",
      status: "trialing",
      phase: "trial_scheduled",
      firstChargeAt: "2026-12-24",
    });

    const { result } = renderHook(() => useCheckoutMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        plan: "annual",
        method: "credit_card",
        customer: { name: "TESTE", email: "t@e.com", cpf: "12345678909" },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: USER_SUBSCRIPTION_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: INVOICES_KEY });
  });

  it("remove variáveis sensíveis e descarta a mutation do MutationCache após settled (D-09)", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });

    updateSubscriptionCreditCardMock.mockRejectedValueOnce(new Error("Cartão recusado"));

    const { result } = renderHook(() => useUpdateSubscriptionCardMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const payload = {
      holderName: "FULANO TAL",
      number: "4111111111111111",
      expiryMonth: "12",
      expiryYear: "28",
      ccv: "123",
    };

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toThrow("Cartão recusado");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(payload.number).toBe("");
    expect(payload.ccv).toBe("");
    expect(payload.holderName).toBe("");
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  });
});
