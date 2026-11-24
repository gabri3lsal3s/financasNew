import { describe, expect, it } from "vitest";
import { isQueryPending } from "./query-readiness";

describe("isQueryPending", () => {
  it("retorna false quando desabilitada ou quando a query é nula/indefinida", () => {
    expect(isQueryPending(undefined)).toBe(false);
    expect(isQueryPending(null)).toBe(false);
    expect(isQueryPending({ isLoading: true, isPending: true }, false)).toBe(false);
    expect(isQueryPending({ isPending: true }, false)).toBe(false);
  });

  it("retorna true enquanto estiver carregando inicialmente (isLoading ou isPending === true)", () => {
    expect(isQueryPending({ isLoading: true, isPending: true })).toBe(true);
    expect(isQueryPending({ isLoading: true, isPending: false })).toBe(true);
    expect(isQueryPending({ isLoading: false, isPending: true })).toBe(true);
    expect(isQueryPending({ isPending: true })).toBe(true);
  });

  it("retorna false quando resolvida (incluindo mocks legados sem isPending)", () => {
    expect(isQueryPending({ isLoading: false, isPending: false })).toBe(false);
    expect(isQueryPending({ isLoading: false })).toBe(false);
    expect(isQueryPending({})).toBe(false);
  });
});
