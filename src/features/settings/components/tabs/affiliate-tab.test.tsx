import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AffiliateTab } from "./affiliate-tab";
import * as stateModule from "@/state";

describe("AffiliateTab", () => {
  beforeEach(() => {
    vi.spyOn(stateModule, "useUpdateAffiliatePix").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpdateAffiliatePix>);
  });

  it("renderiza tela de boas-vindas para novo parceiro e permite ativação", async () => {
    vi.spyOn(stateModule, "useAffiliateDashboard").mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.useAffiliateDashboard>);

    const mutateAsyncMock = vi.fn().mockResolvedValue({});
    vi.spyOn(stateModule, "useGetOrCreateAffiliatePartner").mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useGetOrCreateAffiliatePartner>);

    render(<AffiliateTab />);

    expect(screen.getByText("Programa de Embaixadores & Afiliados B2B2C")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ativar Meu Perfil de Parceiro/i })).toBeInTheDocument();

    const activateBtn = screen.getByRole("button", { name: /Ativar Meu Perfil de Parceiro/i });
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalled();
    });
  });

  it("renderiza métricas e dados de repasse quando parceiro já está ativo", () => {
    vi.spyOn(stateModule, "useAffiliateDashboard").mockReturnValue({
      data: {
        partner: {
          id: "partner-1",
          referral_code: "AXIS-PRO10",
          commission_rate: 0.3,
          pix_key: "gabriel@email.com",
          pix_key_type: "email",
          status: "active",
          created_at: "2026-11-01T10:00:00Z",
        },
        metrics: {
          total_referred_users: 12,
          active_pro_users: 8,
          estimated_commission_cents: 7176,
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.useAffiliateDashboard>);

    vi.spyOn(stateModule, "useUpdateAffiliatePix").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpdateAffiliatePix>);

    render(<AffiliateTab />);

    expect(screen.getByText("Total de Indicados")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Assinantes Pro Ativos")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Código: AXIS-PRO10")).toBeInTheDocument();
  });
});
