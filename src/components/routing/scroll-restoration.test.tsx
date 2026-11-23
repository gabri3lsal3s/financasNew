import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as scrollService from "@/services/scroll";
import { ScrollRestoration } from "./scroll-restoration";

function TestNavigator({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(to)}>
      Navigate
    </button>
  );
}

describe("ScrollRestoration component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("aciona resetPageScroll ao mudar de pathname (ex: /apresentacao -> /assinatura)", () => {
    const resetSpy = vi.spyOn(scrollService, "resetPageScroll").mockImplementation(() => {});

    const { getByRole } = render(
      <MemoryRouter initialEntries={["/apresentacao"]}>
        <ScrollRestoration />
        <Routes>
          <Route path="/apresentacao" element={<TestNavigator to="/assinatura?plan=pro-anual" />} />
          <Route path="/assinatura" element={<div>Checkout</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(resetSpy).not.toHaveBeenCalled();

    fireEvent.click(getByRole("button", { name: "Navigate" }));

    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it("não reseta o scroll quando apenas a query string muda na mesma rota", () => {
    const resetSpy = vi.spyOn(scrollService, "resetPageScroll").mockImplementation(() => {});

    const { getByRole } = render(
      <MemoryRouter initialEntries={["/orcamentos"]}>
        <ScrollRestoration />
        <Routes>
          <Route path="/orcamentos" element={<TestNavigator to="/orcamentos?tab=goals" />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(getByRole("button", { name: "Navigate" }));

    expect(resetSpy).not.toHaveBeenCalled();
  });
});
