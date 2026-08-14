import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollToTopButton } from "./scroll-to-top-button";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubScrollY(value: number): void {
  Object.defineProperty(window, "scrollY", { value, configurable: true, writable: true });
}

describe("ScrollToTopButton (F9 — Decisão D)", () => {
  it("fica oculto antes do limiar e aparece após 300px de rolagem", async () => {
    stubScrollY(0);
    const { container } = render(<ScrollToTopButton />);
    expect(container.querySelector("button")).toBeNull();

    stubScrollY(420);
    fireEvent.scroll(window);

    expect(await screen.findByRole("button", { name: "Voltar ao topo" })).toBeInTheDocument();
  });

  it("rola suavemente ao topo no clique", async () => {
    const scrollToMock = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    stubScrollY(500);
    render(<ScrollToTopButton />);
    fireEvent.scroll(window);

    const button = await screen.findByRole("button", { name: "Voltar ao topo" });
    fireEvent.click(button);

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("rola instantaneamente com prefers-reduced-motion", async () => {
    const scrollToMock = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    stubScrollY(500);
    render(<ScrollToTopButton />);
    fireEvent.scroll(window);

    const button = await screen.findByRole("button", { name: "Voltar ao topo" });
    fireEvent.click(button);

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
