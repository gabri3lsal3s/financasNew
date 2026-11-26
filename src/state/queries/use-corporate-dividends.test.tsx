import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CorporateDividend,
  PortfolioAsset,
  PortfolioDividend,
  PortfolioDividendDismissal,
  PortfolioTransaction,
  UserDividendEvent,
  UserPreferences,
} from "@/types";
import { useCorporateDividends } from "./use-corporate-dividends";
import { useSetDividendTracking } from "../mutations/portfolio/use-portfolio-asset-mutations";
import { PORTFOLIO_QUERY_KEYS } from "../mutations/portfolio/portfolio-keys";
import { userPreferencesKey } from "./use-user-preferences";

let mockAssets: PortfolioAsset[] = [];
let mockTxs: PortfolioTransaction[] = [];
let mockManualDividends: PortfolioDividend[] = [];
let mockCorpDividends: CorporateDividend[] = [];
let mockUserEvents: UserDividendEvent[] = [];
let mockDismissals: PortfolioDividendDismissal[] = [];
let mockUserPrefs: UserPreferences | null = null;
const mockSetTrackingRpc = vi.fn();

vi.mock("@/data/repositories/portfolio", () => ({
  listCorporateDividends: async () => mockCorpDividends,
  listPortfolioDividendDismissals: async () => mockDismissals,
  listUserDividendEvents: async () => mockUserEvents,
  createPortfolioAsset: vi.fn(),
  deletePortfolioAsset: vi.fn(),
  updatePortfolioAsset: vi.fn(),
}));

vi.mock("@/data/rpc/portfolio", () => ({
  setDividendTrackingAtomicRpc: (...args: unknown[]) => mockSetTrackingRpc(...args),
}));

vi.mock("@/data/repositories/asset-prices", () => ({
  consolidateAssetPrices: () => new Map(),
}));

vi.mock("@/state/demo-mode", () => ({
  useDemoSession: () => ({ isDemoActive: false }),
}));

vi.mock("./use-asset-prices", () => ({
  useAssetPrices: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("./use-portfolio", () => ({
  usePortfolioAssets: () => ({ data: mockAssets, isLoading: false, isError: false }),
  useAllPortfolioTransactions: () => ({ data: mockTxs, isLoading: false, isError: false }),
  usePortfolioDividends: () => ({ data: mockManualDividends, isLoading: false, isError: false }),
}));

vi.mock("./use-user-preferences", () => ({
  userPreferencesKey: ["user-preferences"] as const,
  useUserPreferences: () => ({ data: mockUserPrefs, isLoading: false, isError: false }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useCorporateDividends + useSetDividendTracking (S1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssets = [];
    mockTxs = [];
    mockManualDividends = [];
    mockCorpDividends = [];
    mockUserEvents = [];
    mockDismissals = [];
    mockUserPrefs = {
      user_id: "u1",
      theme: "system",
      reminders_enabled: true,
      reminder_days_before_debt: 3,
      reminder_days_before_bill: 3,
      report_weights_enabled: false,
      max_sector_acoes: 25,
      max_sector_fiis: 25,
      app_mode: "investor",
      custom_settings: {
        dividendAutomation: {
          trackingStartDate: "2026-11-20",
        },
      },
    };
  });

  it("carteira com 20 ativos e 165 eventos históricos anteriores ao corte exclui todos já no 1º render e reserva IDs zerados", async () => {
    mockAssets = Array.from({ length: 20 }, (_, i) => ({
      id: `asset-${i + 1}`,
      user_id: "u1",
      ticker: `TICK${i + 1}`,
      asset_class: "Ações",
      currency: "BRL",
      quantity: 100,
      average_price: 20,
      accumulated_dividends: i < 2 ? 300 : 0, // 2 ativos pendentes de calibração
      dividends_start_date: null,
      created_at: "2026-01-01T10:00:00Z",
    }));

    // 165 eventos históricos antes do corte 2026-11-20
    mockCorpDividends = Array.from({ length: 165 }, (_, idx) => ({
      id: `corp-old-${idx + 1}`,
      ticker: `TICK${(idx % 20) + 1}`,
      type: "DIVIDENDO",
      com_date: "2026-10-15",
      payment_date: "2026-11-10",
      rate: 0.5,
      net_rate: 0.5,
      currency: "BRL",
    }));

    // Alguns já materializados com zero (saneados no banco) -> nunca devem voltar pelo fallback
    mockUserEvents = [
      {
        id: "ev-zero-1",
        user_id: "u1",
        corporate_dividend_id: "corp-old-1",
        asset_id: "asset-3",
        ticker: "TICK3",
        type: "DIVIDENDO",
        status: "PENDING_CONFIRMATION",
        com_date: "2026-10-15",
        payment_date: "2026-11-10",
        quantity_on_com_date: 0,
        gross_rate: 0.5,
        net_rate: 0.5,
        tax_rate_pct: 0,
        gross_amount: 0,
        net_amount: 0,
        currency: "BRL",
        is_manual: false,
        is_type_uncertain: false,
        manual_review_required: false,
        revision: 2,
      },
      // Evento elegível manual deve permanecer visível mesmo antes do corte
      {
        id: "ev-manual-1",
        user_id: "u1",
        corporate_dividend_id: null,
        asset_id: "asset-3",
        ticker: "TICK3",
        type: "JCP",
        status: "PROVISIONED",
        com_date: "2026-10-15",
        payment_date: null,
        quantity_on_com_date: 100,
        gross_rate: 1,
        net_rate: 0.85,
        tax_rate_pct: 15,
        gross_amount: 100,
        net_amount: 85,
        currency: "BRL",
        is_manual: true,
        is_type_uncertain: false,
        manual_review_required: false,
        revision: 1,
      },
    ];

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCorporateDividends(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assetsNeedingCalibration).toHaveLength(2);
    expect(result.current.available).toHaveLength(0);
    // Apenas o evento manual visível
    expect(result.current.projected).toHaveLength(1);
    expect(result.current.projected[0]?.eventId).toBe("ev-manual-1");
    expect(result.current.totalProjectedBRL).toBe(85);
    expect(result.current.provisionedSummary.totalReceivableBRLCents).toBe(8500);
  });

  it("exige coerência de lotes mistos PETR4 + PETR4F e preserva edições humanas / manual_review_required", async () => {
    mockAssets = [
      {
        id: "lot-petr4",
        user_id: "u1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 100,
        average_price: 30,
        accumulated_dividends: 200,
        dividends_start_date: "2026-11-15",
        created_at: "2026-01-01T10:00:00Z",
      },
      {
        id: "lot-petr4f",
        user_id: "u1",
        ticker: "PETR4F",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 10,
        average_price: 30,
        accumulated_dividends: 0,
        dividends_start_date: "2026-01-01",
        created_at: "2026-01-01T10:00:00Z",
      },
    ];
    mockTxs = [
      { id: "t1", user_id: "u1", asset_id: "lot-petr4", type: "buy", date: "2026-01-10", quantity: 100, price: 30, total: 3000 },
      { id: "t2", user_id: "u1", asset_id: "lot-petr4f", type: "buy", date: "2026-01-10", quantity: 10, price: 30, total: 300 },
    ];
    mockUserPrefs = {
      ...mockUserPrefs!,
      custom_settings: { dividendAutomation: { trackingStartDate: "2026-01-01" } },
    };
    mockUserEvents = [
      // Evento misto antigo somando 110 (obsoleto depois do corte de PETR4 em 15/11) -> ocultado até recomposição do cron
      {
        id: "ev-mixed-stale",
        user_id: "u1",
        corporate_dividend_id: "corp-petr-oct",
        asset_id: "lot-petr4",
        ticker: "PETR4",
        type: "DIVIDENDO",
        status: "PENDING_CONFIRMATION",
        com_date: "2026-10-15",
        payment_date: "2026-11-05",
        quantity_on_com_date: 110,
        gross_rate: 1,
        net_rate: 1,
        tax_rate_pct: 0,
        gross_amount: 110,
        net_amount: 110,
        currency: "BRL",
        is_manual: false,
        is_type_uncertain: false,
        manual_review_required: false,
        revision: 1,
      },
      // Evento editado pelo usuário -> preservado mesmo com data COM anterior ao corte
      {
        id: "ev-human-edited",
        user_id: "u1",
        corporate_dividend_id: "corp-petr-human",
        asset_id: "lot-petr4",
        ticker: "PETR4",
        type: "JCP",
        status: "PENDING_CONFIRMATION",
        com_date: "2026-10-01",
        payment_date: "2026-11-02",
        quantity_on_com_date: 90,
        gross_rate: 1,
        net_rate: 0.85,
        tax_rate_pct: 15,
        gross_amount: 90,
        net_amount: 76.5,
        currency: "BRL",
        is_manual: false,
        is_type_uncertain: false,
        manual_review_required: true,
        revision: 3,
      },
    ];

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCorporateDividends(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.available.map((x) => x.eventId)).toEqual(["ev-human-edited"]);
  });

  it("useSetDividendTracking aplica cache de preferências, ativos e eventos invalidados antes do refetch", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(userPreferencesKey, mockUserPrefs);
    client.setQueryData(PORTFOLIO_QUERY_KEYS.assets, [
      {
        id: "a1",
        user_id: "u1",
        ticker: "MXRF11",
        asset_class: "FIIs",
        currency: "BRL",
        quantity: 100,
        average_price: 10,
        accumulated_dividends: 50,
        dividends_start_date: null,
      },
    ]);
    client.setQueryData(PORTFOLIO_QUERY_KEYS.userDividendEvents, [
      {
        id: "ev-1",
        user_id: "u1",
        corporate_dividend_id: "c1",
        asset_id: "a1",
        ticker: "MXRF11",
        type: "RENDIMENTO",
        status: "PROVISIONED",
        com_date: "2026-10-10",
        payment_date: "2026-11-30",
        quantity_on_com_date: 100,
        gross_rate: 0.1,
        net_rate: 0.1,
        tax_rate_pct: 0,
        gross_amount: 10,
        net_amount: 10,
        currency: "BRL",
        is_manual: false,
        is_type_uncertain: false,
        manual_review_required: false,
        revision: 1,
      },
    ]);

    mockSetTrackingRpc.mockResolvedValue({
      success: true,
      tracking_start_date: "2026-11-01",
      updated_assets: [{ asset_id: "a1", dividends_start_date: "2026-11-01" }],
      updated_assets_count: 1,
      affected_events_count: 1,
      protected_events_count: 0,
      invalidated_event_ids: ["ev-1"],
    });

    const { result } = renderHook(() => useSetDividendTracking(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        trackingStartDate: "2026-11-01",
        assets: [{ asset_id: "a1", expected_start: null, start_date: "2026-11-01" }],
        expectedTrackingStartDate: "2026-11-20",
      });
    });

    const updatedPrefs = client.getQueryData<UserPreferences>(userPreferencesKey);
    const updatedAssets = client.getQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets);
    const updatedEvents = client.getQueryData<UserDividendEvent[]>(
      PORTFOLIO_QUERY_KEYS.userDividendEvents,
    );

    expect(updatedPrefs?.custom_settings?.dividendAutomation?.trackingStartDate).toBe("2026-11-01");
    expect(updatedAssets?.[0]?.dividends_start_date).toBe("2026-11-01");
    expect(updatedEvents?.[0]?.quantity_on_com_date).toBe(0);
    expect(updatedEvents?.[0]?.net_amount).toBe(0);
    expect(updatedEvents?.[0]?.revision).toBe(2);
  });

  it("promove evento aberto sem payment_date por prazo (15 pregões BR) e preserva trustTier/provider real (S2)", async () => {
    mockAssets = [
      {
        id: "lot-mxrf",
        user_id: "u1",
        ticker: "MXRF11",
        asset_class: "FIIs",
        currency: "BRL",
        quantity: 100,
        average_price: 10,
        accumulated_dividends: 0,
        dividends_start_date: "2026-01-01",
        created_at: "2026-01-01T10:00:00Z",
      },
    ];
    mockTxs = [
      {
        id: "tx-1",
        user_id: "u1",
        asset_id: "lot-mxrf",
        type: "buy",
        date: "2026-01-05",
        quantity: 100,
        price: 10,
        total: 1000,
      },
    ];
    mockUserPrefs = {
      ...mockUserPrefs!,
      custom_settings: { dividendAutomation: { trackingStartDate: "2026-01-01" } },
    };
    mockCorpDividends = [
      {
        id: "corp-mxrf-old",
        ticker: "MXRF11",
        type: "DIVIDENDO",
        com_date: "2026-09-01", // > 15 pregões BR atrás em relação a hoje
        payment_date: null,
        rate: 0.1,
        net_rate: 0.1,
        tax_rate_pct: 0,
        currency: "BRL",
        provider: "yahoo",
        trust_tier: "raw_fallback",
        is_type_uncertain: true,
      },
    ];
    mockUserEvents = [
      {
        id: "ev-mxrf-1",
        user_id: "u1",
        corporate_dividend_id: "corp-mxrf-old",
        asset_id: "lot-mxrf",
        ticker: "MXRF11",
        type: "DIVIDENDO",
        status: "PROVISIONED",
        com_date: "2026-09-01",
        payment_date: null,
        quantity_on_com_date: 100,
        gross_rate: 0.1,
        net_rate: 0.1,
        tax_rate_pct: 0,
        gross_amount: 10,
        net_amount: 10,
        currency: "BRL",
        is_manual: false,
        is_type_uncertain: true,
        manual_review_required: false,
        revision: 1,
      },
    ];

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCorporateDividends(), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.available).toHaveLength(1);
    expect(result.current.projected).toHaveLength(0);
    expect(result.current.available[0]?.paymentDate).toBeNull();
    expect(result.current.available[0]?.trustTier).toBe("raw_fallback");
    expect(result.current.available[0]?.provider).toBe("yahoo");
  });
});
