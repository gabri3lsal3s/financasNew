import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todaySaoPauloISO, type SuggestedDividendItem } from "@/domain/portfolio";
import type { PortfolioAsset } from "@/types";
import { PendingDividendsDialog } from "./pending-dividends-dialog";

const mockConfirmMutateAsync = vi.fn();
const mockSetTrackingMutateAsync = vi.fn();
const mockDismissMutateAsync = vi.fn();
const mockCreateManualMutateAsync = vi.fn();
const mockDeleteManualMutateAsync = vi.fn();
const mockUpdateEventMutateAsync = vi.fn();

let mockAssets: PortfolioAsset[] = [];

vi.mock("@/state", () => ({
  useUserPreferences: () => ({
    data: {
      custom_settings: {
        dividendAutomation: {
          autoCreditCash: true,
          trackingStartDate: "2026-10-01",
        },
      },
    },
  }),
  usePortfolioAssets: () => ({ data: mockAssets }),
  useAllPortfolioTransactions: () => ({ data: [] }),
  useConfirmUserDividendEvents: () => ({
    mutateAsync: mockConfirmMutateAsync,
    isPending: false,
  }),
  useDismissUserDividendEvent: () => ({
    mutateAsync: mockDismissMutateAsync,
    isPending: false,
  }),
  useCreateManualUserDividendEvent: () => ({
    mutateAsync: mockCreateManualMutateAsync,
    isPending: false,
  }),
  useDeleteUserDividendEvent: () => ({
    mutateAsync: mockDeleteManualMutateAsync,
    isPending: false,
  }),
  useUpdateUserDividendEvent: () => ({
    mutateAsync: mockUpdateEventMutateAsync,
    isPending: false,
  }),
  useSetDividendTracking: () => ({
    mutateAsync: mockSetTrackingMutateAsync,
    isPending: false,
  }),
  useCorporateDividends: () => ({
    available: [],
    projected: [],
    assetsNeedingCalibration: [],
    trackingStartDate: "2026-10-01",
    fxRate: 5.25,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mutation-guard", () => ({
  useMutationGuard: () => ({
    guardAction: (fn: () => void) => fn(),
    upgradeModal: null,
    isReadOnlyMode: false,
  }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("PendingDividendsDialog (S1 — Calibração coletiva e confirmação segura)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssets = [
      {
        id: "asset-1",
        user_id: "u1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 30,
        accumulated_dividends: 450,
        dividends_start_date: null,
      },
      {
        id: "asset-2",
        user_id: "u1",
        ticker: "MXRF11",
        asset_class: "FIIs",
        currency: "BRL",
        quantity: 200,
        average_price: 10,
        accumulated_dividends: 120,
        dividends_start_date: null,
      },
    ];
  });

  it("exibe 'Calibrar N ativos' mesmo com filas vazias, aplica data comum + exceção em 1 chamada e preserva rascunho em erro com 'Tentar novamente'", async () => {
    const user = userEvent.setup();
    render(
      <PendingDividendsDialog
        open={true}
        onOpenChange={vi.fn()}
        availableDividends={[]}
        projectedDividends={[]}
        assetsNeedingCalibration={mockAssets}
        trackingStartDate="2026-10-01"
      />,
    );

    expect(screen.getByText("Calibrar 2 ativos")).toBeInTheDocument();
    // Nenhum input deve ter autoFocus
    expect(document.querySelectorAll("[autofocus]")).toHaveLength(0);

    // Escolhe data comum via DatePicker ("Hoje")
    await user.click(screen.getByRole("button", { name: "Data inicial comum para calibração" }));
    await user.click(await screen.findByRole("button", { name: /^Hoje$/i }));

    // Define exceção para MXRF11 via DatePicker ("Ontem")
    await user.click(screen.getByRole("button", { name: "Data inicial de MXRF11" }));
    await user.click(await screen.findByRole("button", { name: /^Ontem$/i }));

    expect(screen.getByText(/Primeiro dia coberto pela automação:/i)).toBeInTheDocument();

    const applyBtn = screen.getByRole("button", { name: /Aplicar aos selecionados \(2\)/i });

    // Primeira tentativa falha -> preserva rascunho e oferece Tentar novamente
    mockSetTrackingMutateAsync.mockRejectedValueOnce(new Error("Falha temporária de rede"));
    await user.click(applyBtn);

    expect(await screen.findByText(/Falha temporária de rede/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "Tentar novamente" });

    // Retry sucede com os dois lotes deduplicados
    mockSetTrackingMutateAsync.mockResolvedValueOnce({
      success: true,
      tracking_start_date: "2026-10-01",
      updated_assets: [],
      updated_assets_count: 2,
      affected_events_count: 0,
      protected_events_count: 0,
      invalidated_event_ids: [],
    });
    await user.click(retryBtn);

    await waitFor(() => expect(mockSetTrackingMutateAsync).toHaveBeenCalledTimes(2));
    const callArg = mockSetTrackingMutateAsync.mock.calls[1]?.[0] as {
      trackingStartDate: string | null;
      assets: Array<{ asset_id: string; expected_start: string | null; start_date: string | null }>;
    };
    expect(callArg.trackingStartDate).toBeNull();
    expect(callArg.assets).toHaveLength(2);
    expect(callArg.assets[0]?.asset_id).toBe("asset-1");
    expect(callArg.assets[1]?.asset_id).toBe("asset-2");
    expect(callArg.assets[0]?.start_date).not.toBe(callArg.assets[1]?.start_date);
  });

  it("exige data real em 'Confirmar agora' para provisionado sem data e envia expected_revision ao confirmar com data válida", async () => {
    const today = todaySaoPauloISO();
    const monthPrefix = today.slice(0, 7);
    const comDate = `${monthPrefix}-01`;

    const projectedItem: SuggestedDividendItem = {
      corporateDividendId: "corp-lvbi",
      eventId: "ev-lvbi",
      assetId: "asset-lvbi",
      ticker: "LVBI11",
      type: "RENDIMENTO",
      comDate,
      paymentDate: null,
      quantityOnComDate: 100,
      rate: 0.9,
      netRate: 0.9,
      taxRatePct: 0,
      grossAmount: 90,
      totalAmount: 90,
      currency: "BRL",
      status: "projected",
      isManual: false,
      revision: 3,
    };

    const user = userEvent.setup();
    render(
      <PendingDividendsDialog
        open={true}
        onOpenChange={vi.fn()}
        availableDividends={[]}
        projectedDividends={[projectedItem]}
        assetsNeedingCalibration={[]}
      />,
    );

    // Abre a aba Provisionados e clica em Confirmar agora sem data
    await user.click(screen.getByRole("tab", { name: /Provisionados/i }));
    await user.click(screen.getByRole("button", { name: "Confirmar agora" }));
    expect(mockConfirmMutateAsync).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Informe uma data entre/i),
    ).toBeInTheDocument();

    // Seleciona a data real ("Hoje") no DatePicker inline do item
    await user.click(screen.getByRole("button", { name: "Data real de pagamento de LVBI11" }));
    const calendar = await screen.findByRole("grid");
    expect(calendar).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Hoje$/i }));

    mockConfirmMutateAsync.mockResolvedValueOnce({ success: true });
    await user.click(screen.getByRole("button", { name: "Confirmar recebimento" }));

    await waitFor(() => expect(mockConfirmMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockConfirmMutateAsync).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({
          event_id: "ev-lvbi",
          expected_revision: 3,
          date: today,
          amount: 90,
        }),
      ],
      sync_cash: true,
    });
  });

  it("bloqueia confirmação em lote se item selecionado não possuir data real válida e valida dentro do calendário", async () => {
    const today = todaySaoPauloISO();
    const comDate = `${today.slice(0, 7)}-01`;
    const availableWithoutDate: SuggestedDividendItem = {
      corporateDividendId: "corp-no-pay",
      eventId: "ev-no-pay",
      assetId: "asset-1",
      ticker: "PETR4",
      type: "DIVIDENDO",
      comDate,
      paymentDate: null,
      quantityOnComDate: 100,
      rate: 0.5,
      netRate: 0.5,
      taxRatePct: 0,
      grossAmount: 50,
      totalAmount: 50,
      currency: "BRL",
      status: "available",
      isManual: false,
      revision: 2,
    };

    const user = userEvent.setup();
    render(
      <PendingDividendsDialog
        open={true}
        onOpenChange={vi.fn()}
        availableDividends={[availableWithoutDate]}
        projectedDividends={[]}
        assetsNeedingCalibration={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Aprovar no Caixa \(1\)/i }));
    expect(mockConfirmMutateAsync).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Informe a data real de pagamento \(entre a Data COM e hoje\)/i),
    ).toBeInTheDocument();

    // Preenche dia 01 via calendário (COM === dia 01 <= hoje)
    await user.click(screen.getByRole("button", { name: "Data real de pagamento de PETR4" }));
    const grid = await screen.findByRole("grid");
    const day01 = within(grid)
      .getAllByRole("gridcell")
      .find((cell) => cell.textContent?.trim() === "1");
    if (!day01) throw new Error("Dia 1 não encontrado");
    await user.click(within(day01).getByRole("button"));

    mockConfirmMutateAsync.mockResolvedValueOnce({ success: true });
    await user.click(screen.getByRole("button", { name: /Aprovar no Caixa \(1\)/i }));

    await waitFor(() => expect(mockConfirmMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockConfirmMutateAsync).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({
          event_id: "ev-no-pay",
          expected_revision: 2,
          date: comDate,
        }),
      ],
      sync_cash: true,
    });
  });

  it("S4: exibe 3 abas, badges de origem reais, filtros e exige data no Confirmar agora sem data", async () => {
    const user = userEvent.setup();
    render(
      <PendingDividendsDialog
        open={true}
        onOpenChange={vi.fn()}
        availableDividends={[
          {
            corporateDividendId: "c-off",
            eventId: "ev-off",
            assetId: "a1",
            ticker: "PETR4",
            type: "DIVIDENDO",
            comDate: "2026-10-01",
            paymentDate: "2026-10-10",
            quantityOnComDate: 100,
            rate: 1,
            netRate: 1,
            taxRatePct: 0,
            grossAmount: 100,
            totalAmount: 100,
            currency: "BRL",
            status: "available",
            provider: "brapi",
            trustTier: "official",
            isManual: false,
            revision: 1,
          },
        ]}
        projectedDividends={[
          {
            corporateDividendId: "c-proj",
            eventId: "ev-proj",
            assetId: "a2",
            ticker: "MXRF11",
            type: "RENDIMENTO",
            comDate: "2026-10-10",
            paymentDate: null,
            quantityOnComDate: 50,
            rate: 0.1,
            netRate: 0.1,
            taxRatePct: 0,
            grossAmount: 5,
            totalAmount: 5,
            currency: "BRL",
            status: "projected",
            provider: "yahoo",
            trustTier: "raw_fallback",
            isManual: false,
            revision: 1,
          },
        ]}
        assetsNeedingCalibration={[]}
      />,
    );

    expect(screen.getByRole("tab", { name: /A Conferir \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Provisionados \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Provisionar Manual/i })).toBeInTheDocument();
    expect(screen.getByText("Oficial")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Provisionados \(1\)/i }));
    expect(screen.getByText("Estimado — conferir")).toBeInTheDocument();
    expect(screen.getByText(/1 sem data/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Confirmar agora/i }));
    const confirmBtn = await screen.findByRole("button", { name: /Confirmar recebimento/i });
    expect(confirmBtn).toBeDisabled();
  });

  it("exibe sugestão de correspondência manual e permite vincular em 1 clique sem novo crédito", async () => {
    const user = userEvent.setup();
    mockUpdateEventMutateAsync.mockResolvedValueOnce({ id: "ev-hgru", status: "SETTLED" });
    const onRetry = vi.fn();

    render(
      <PendingDividendsDialog
        open={true}
        onOpenChange={vi.fn()}
        onRetry={onRetry}
        availableDividends={[
          {
            corporateDividendId: "c-hgru",
            eventId: "ev-hgru",
            assetId: "a-hgru",
            ticker: "HGRU11",
            type: "RENDIMENTO",
            comDate: "2026-09-30",
            paymentDate: null,
            quantityOnComDate: 100,
            rate: 1.2,
            netRate: 1.2,
            taxRatePct: 0,
            grossAmount: 120,
            totalAmount: 120,
            currency: "BRL",
            status: "available",
            provider: "yahoo",
            trustTier: "raw_fallback",
            isManual: false,
            revision: 1,
            suggestedManualMatch: {
              manualId: "man-hgru",
              manualDate: "2026-10-15",
              manualAmount: 120,
              reason: "ambiguous_1to1",
            },
          },
        ]}
        projectedDividends={[]}
        assetsNeedingCalibration={[]}
      />,
    );

    expect(screen.getByText(/Possível correspondência no extrato em/i)).toBeInTheDocument();
    expect(screen.getByText(/15\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Pagamento a confirmar/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Vincular \(sem novo crédito\)/i }));

    await waitFor(() => {
      expect(mockUpdateEventMutateAsync).toHaveBeenCalledWith({
        id: "ev-hgru",
        patch: {
          status: "SETTLED",
          settlement_origin: "dedup",
          settled_dividend_id: "man-hgru",
        },
      });
      expect(onRetry).toHaveBeenCalled();
    });
  });
});
