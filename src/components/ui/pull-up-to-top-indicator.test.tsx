import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PullUpToTopIndicator } from "./pull-up-to-top-indicator";

describe("PullUpToTopIndicator (F26 — indicador do gesto pull-up)", () => {
  it("não renderiza quando o gesto está ocioso (idle / at_bottom)", () => {
    const { container } = render(
      <PullUpToTopIndicator state="idle" progress={0} pullDistance={0} />,
    );
    expect(container.firstChild).toBeNull();

    const { container: c2 } = render(
      <PullUpToTopIndicator state="at_bottom" progress={0} pullDistance={0} />,
    );
    expect(c2.firstChild).toBeNull();
  });

  it("não renderiza com pull nulo mesmo em estado de puxada", () => {
    const { container } = render(
      <PullUpToTopIndicator state="pulling" progress={0} pullDistance={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza durante o arrasto com a seta decorativa", () => {
    render(<PullUpToTopIndicator state="pulling" progress={0.5} pullDistance={40} />);
    const arrow = screen.getByRole("presentation", { hidden: true });
    expect(arrow).toBeInTheDocument();
    // Decoração não-interativa e invisível para leitores de tela.
    expect(arrow.closest("[aria-hidden=true]")).not.toBeNull();
  });

  it("preenche o anel conforme o progresso (stroke-dashoffset decrescente)", () => {
    const { container } = render(
      <PullUpToTopIndicator state="pulling" progress={0.25} pullDistance={20} />,
    );
    const ring = container.querySelector(".stroke-primary");
    expect(ring).not.toBeNull();
    const offset = Number(ring?.getAttribute("stroke-dashoffset"));
    const circumference = 2 * Math.PI * 20;
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThan(circumference);

    const { container: full } = render(
      <PullUpToTopIndicator state="threshold_reached" progress={1} pullDistance={100} />,
    );
    const fullRing = full.querySelector(".stroke-primary");
    expect(Number(fullRing?.getAttribute("stroke-dashoffset"))).toBe(0);
  });

  it("estado armado (threshold_reached) acende a seta com a cor primária", () => {
    const { container } = render(
      <PullUpToTopIndicator state="threshold_reached" progress={1} pullDistance={100} />,
    );
    const arrow = container.querySelector(".text-primary");
    expect(arrow).not.toBeNull();
  });
});
