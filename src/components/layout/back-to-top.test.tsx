import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackToTop } from "./back-to-top";
import * as scrollService from "@/services/scroll";

describe("BackToTop (Layout)", () => {
  it("renderiza o botão com rótulo acessível e classe de ocultação quando visible=false", () => {
    render(<BackToTop visible={false} />);

    const button = screen.getByRole("button", { name: "Voltar ao topo da página" });
    expect(button).toBeInTheDocument();

    const container = button.closest("div");
    expect(container?.className).toContain("opacity-0");
    expect(container?.className).toContain("pointer-events-none");
  });

  it("aplica classes de exibição quando visible=true", () => {
    render(<BackToTop visible={true} />);

    const button = screen.getByRole("button", { name: "Voltar ao topo da página" });
    const container = button.closest("div");

    expect(container?.className).toContain("opacity-100");
    expect(container?.className).toContain("pointer-events-auto");
    expect(container?.className).toContain("z-floating-tools");
    expect(container?.className).toContain("bottom-20");
  });

  it("aciona scrollToTop com containerId correto ao clicar", async () => {
    const scrollToTopSpy = vi.spyOn(scrollService, "scrollToTop").mockReturnValue(true);
    const user = userEvent.setup();

    render(<BackToTop visible={true} containerId="main-content" />);

    const button = screen.getByRole("button", { name: "Voltar ao topo da página" });
    await user.click(button);

    expect(scrollToTopSpy).toHaveBeenCalledWith({
      containerId: "main-content",
      sensoryFeedback: true,
    });

    scrollToTopSpy.mockRestore();
  });
});
