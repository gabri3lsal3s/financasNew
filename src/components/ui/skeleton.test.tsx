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

  it("SkeletonKpi renderiza no formato de card KPI", () => {
    const { container } = render(<SkeletonKpi />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("rounded-xl", "border-border", "bg-surface");
    expect(card.querySelectorAll(".animate-shimmer")).toHaveLength(3);
  });

  it("SkeletonChart e SkeletonTable renderizam nos formatos esperados", () => {
    const { container } = render(
      <>
        <SkeletonChart />
        <SkeletonTable rows={4} />
      </>,
    );
    // Chart: 1 bloco alto; Table: 1 cabeçalho + 4 linhas.
    expect(container.querySelectorAll(".animate-shimmer")).toHaveLength(1 + 1 + 4);
  });
});
