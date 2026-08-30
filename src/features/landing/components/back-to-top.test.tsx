import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackToTop } from "./back-to-top";

describe("BackToTop", () => {
  it("renderiza com classes de opacidade 0 quando visible=false", () => {
    const { container } = render(<BackToTop visible={false} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("opacity-0");
    expect(wrapper).toHaveClass("pointer-events-none");
  });

  it("renderiza visível quando visible=true e dispara scrollTo no clique", async () => {
    const user = userEvent.setup();
    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;

    const { container } = render(<BackToTop visible={true} />);
    const wrapper = container.firstChild as HTMLElement;

    expect(wrapper).toHaveClass("opacity-100");
    expect(wrapper).toHaveClass("pointer-events-auto");

    const button = screen.getByRole("button", { name: /Voltar ao topo da página/i });
    await user.click(button);

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("aplica elevação de safe area quando hasBottomDock=true", () => {
    const { container } = render(<BackToTop visible={true} hasBottomDock={true} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bottom-[calc(4.75rem");
  });
});
