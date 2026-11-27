import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActiveUserId } from "@/services/user-storage";
import { LOANS_QUERY_KEY } from "@/state/queries/use-loans";
import {
  CAROUSEL_EVIDENCE_PREFIX,
  CAROUSEL_EVIDENCE_TTL_MS,
  carouselEvidenceKey,
  clearAllCarouselEvidence,
  publishCarouselEvidence,
  readCarouselEvidence,
  readWarmLoans,
  readWarmTripDetailsMap,
  usePassiveCarouselCache,
  type CarouselEvidenceIdentity,
  type CarouselEvidencePayload,
} from "./carousel-evidence";

const baseIdentity: CarouselEvidenceIdentity = {
  userId: "user-1",
  mode: "auth",
  scope: "personal",
  month: "2026-11",
  asOf: "2026-11-27",
};

const samplePayload: CarouselEvidencePayload = {
  surplusCapacity: {
    operatingBalanceCents: 200_000,
    committedObligationsCents: 100_000,
    pendingRecurringObligationsCents: 0,
    surplusCents: 100_000,
    suggestedAporteCents: 50_000,
    suggestedEmergencyAllocationCents: 0,
    hasSurplus: true,
    allocationIntent: "portfolio_aporte",
  },
  cashGapResult: {
    isCashGapDetected: false,
    severity: "none",
    gapDate: null,
    daysUntilGap: null,
    maxDeficitCents: 0,
    nextInflowDate: null,
    causingObligations: [],
    recommendationMessage: null,
    runway: [],
  },
  isCurrentMonth: true,
  dayOfMonth: 27,
  daysInMonth: 30,
  safeToSpendCents: 80_000,
  hasLiquidityContext: true,
  investmentCents: 0,
  debtsCount: 1,
};

describe("carousel-evidence (cache passivo em memória · Onda 2)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setActiveUserId("user-1");
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("publica somente em memória sem queryFn, sem storage local e evita loop por igualdade semântica", () => {
    const t0 = 1_795_000_000_000;
    const first = publishCarouselEvidence(queryClient, baseIdentity, samplePayload, {
      nowMs: t0,
    });
    expect(first).toBe(true);

    // Clone estrutural idêntico dentro do TTL não deve reescrever cache
    const clonedPayload: CarouselEvidencePayload = JSON.parse(JSON.stringify(samplePayload));
    const second = publishCarouselEvidence(queryClient, baseIdentity, clonedPayload, {
      nowMs: t0 + 1_000,
    });
    expect(second).toBe(false);

    const entry = queryClient.getQueryCache().find({
      queryKey: carouselEvidenceKey(baseIdentity),
      exact: true,
    });
    expect(entry).toBeDefined();
    expect(entry?.options.queryFn).toBeUndefined();
    expect(window.localStorage.length).toBe(1); // apenas activeUserId, zero evidência financeira
    expect(window.sessionStorage.length).toBe(0);
  });

  it("não publica sem userId e expira após menor staleTime das fontes", () => {
    const noUser = publishCarouselEvidence(
      queryClient,
      { ...baseIdentity, userId: null },
      samplePayload,
    );
    expect(noUser).toBe(false);
    expect(queryClient.getQueryCache().findAll({ queryKey: CAROUSEL_EVIDENCE_PREFIX })).toHaveLength(0);

    const t0 = 1_795_000_000_000;
    publishCarouselEvidence(queryClient, baseIdentity, samplePayload, { nowMs: t0 });
    expect(readCarouselEvidence(queryClient, baseIdentity, t0 + CAROUSEL_EVIDENCE_TTL_MS - 1)).not.toBeNull();
    expect(readCarouselEvidence(queryClient, baseIdentity, t0 + CAROUSEL_EVIDENCE_TTL_MS)).toBeNull();
  });

  it("remove chaves anteriores ao trocar usuário, modo, escopo, mês ou data", () => {
    publishCarouselEvidence(queryClient, baseIdentity, samplePayload);
    publishCarouselEvidence(
      queryClient,
      { ...baseIdentity, scope: "business" },
      samplePayload,
    );

    expect(readCarouselEvidence(queryClient, baseIdentity)).toBeNull();
    expect(
      readCarouselEvidence(queryClient, { ...baseIdentity, scope: "business" }),
    ).not.toBeNull();

    publishCarouselEvidence(queryClient, { ...baseIdentity, scope: "business", asOf: "2026-11-28" }, samplePayload);
    expect(readCarouselEvidence(queryClient, { ...baseIdentity, scope: "business" })).toBeNull();
  });

  it("limpa evidência no logout e quando uma fonte dependente é invalidada sem disparar refetch", async () => {
    const expenseSpy = vi.fn(async () => []);
    await queryClient.prefetchQuery({
      queryKey: ["expenses", "2026-11"],
      queryFn: expenseSpy,
    });
    expect(expenseSpy).toHaveBeenCalledTimes(1);

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => usePassiveCarouselCache(baseIdentity), { wrapper });

    act(() => {
      result.current.publish(samplePayload);
    });
    expect(result.current.evidence?.surplusCapacity.suggestedAporteCents).toBe(50_000);

    // Invalidação de expenses sem refetch ativo limpa a projeção em memória
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ["expenses", "2026-11"],
        refetchType: "none",
      });
    });
    expect(result.current.evidence).toBeNull();
    expect(expenseSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.publish(samplePayload);
    });
    expect(result.current.evidence).not.toBeNull();

    // Logout limpa tudo
    act(() => {
      setActiveUserId(null);
    });
    expect(result.current.evidence).toBeNull();

    // Troca de UID reativa passa a ler evidência da nova conta sem herdar a anterior
    act(() => {
      setActiveUserId("user-2");
    });
    expect(result.current.evidence).toBeNull();
    act(() => {
      publishCarouselEvidence(queryClient, { ...baseIdentity, userId: "user-2" }, {
        ...samplePayload,
        safeToSpendCents: 120_000,
      });
    });
    expect(result.current.evidence?.safeToSpendCents).toBe(120_000);

    // Mesmo se identity passado ao hook tiver userId antigo, mode=auth prioriza activeUserId
    act(() => {
      setActiveUserId("user-3");
    });
    expect(result.current.evidence).toBeNull();
    clearAllCarouselEvidence(queryClient);
    expect(queryClient.getQueryCache().findAll({ queryKey: CAROUSEL_EVIDENCE_PREFIX })).toHaveLength(0);
  });

  it("readWarmLoans e readWarmTripDetailsMap só devolvem entradas em status success e não invalidadas", async () => {
    const loansSpy = vi.fn(async () => [{ id: "loan-1" }]);
    await queryClient.prefetchQuery({ queryKey: LOANS_QUERY_KEY, queryFn: loansSpy });
    expect(readWarmLoans(queryClient)).toHaveLength(1);

    await queryClient.invalidateQueries({ queryKey: LOANS_QUERY_KEY, refetchType: "none" });
    expect(readWarmLoans(queryClient)).toBeUndefined();
    expect(loansSpy).toHaveBeenCalledTimes(1);

    expect(readWarmTripDetailsMap(queryClient, ["trip-missing"]).size).toBe(0);
  });

  it("ignora observerOptionsUpdated de queries passivas sem disparar loop de cacheVersion", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    let renders = 0;
    const { result, rerender } = renderHook(
      () => {
        renders += 1;
        useQuery({
          queryKey: LOANS_QUERY_KEY,
          queryFn: async () => [],
          enabled: false,
        });
        return usePassiveCarouselCache(baseIdentity);
      },
      { wrapper },
    );

    expect(result.current.cacheVersion).toBe(0);
    expect(renders).toBeLessThanOrEqual(2);

    act(() => {
      rerender();
    });
    act(() => {
      rerender();
    });

    // Eventos observerOptionsUpdated emitidos por useQuery a cada render não devem incrementar cacheVersion
    expect(result.current.cacheVersion).toBe(0);
    expect(renders).toBeLessThanOrEqual(4);
  });
});
