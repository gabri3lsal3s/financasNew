import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton, SkeletonChart, SkeletonKpi, SkeletonList, SkeletonTable } from "./skeleton";

describe("Skeleton por contexto (F12 — polimento)", () => {
  it("Skeleton base renderiza com shimmer e aria-hidden", () => {
    const { container } = render(<Skeleton className="h-10 w-full" />);
    const block = container.firstChild as HTMLElement;
    expect(block).toHaveClass("animate-shimmer", "h-10");
    expect(block).toHaveAttribute("aria-hidden", "true");
  });

  it("SkeletonList renderiza N linhas no formato de lista", () => {
    const { container } = render(<SkeletonList rows={3} />);
    // Cada linha = 1 ícone + 2 linhas de texto + 1 valor → 4 blocos + wrapper.
    expect(container.querySelectorAll("[aria-hidden='true'] .animate-shimmer")).toHaveLength(3 * 4);
  });

  it("SkeletonKpi renderiza no formato canônico de card KPI com Zero CLS", () => {
    const { container } = render(<SkeletonKpi />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("rounded-2xl", "bg-surface", "shadow-xs");
    expect(card.querySelectorAll(".animate-shimmer")).toHaveLength(3);
  });

  it("SkeletonChart e SkeletonTable renderizam nos formatos estruturados de Zero CLS", () => {
    const { container: chartContainer } = render(<SkeletonChart />);
    expect(chartContainer.querySelector("[aria-hidden='true']")).toHaveClass("rounded-2xl", "bg-surface");
    expect(chartContainer.querySelectorAll(".animate-shimmer")).toHaveLength(6);

    const { container: tableContainer } = render(<SkeletonTable rows={4} />);
    expect(tableContainer.querySelector("[aria-hidden='true']")).toHaveClass("rounded-2xl", "bg-surface");
    // Table: 2 blocos no cabeçalho + 4 linhas (4 subelementos cada) = 18 blocos
    expect(tableContainer.querySelectorAll(".animate-shimmer")).toHaveLength(2 + 4 * 4);
  });
});
