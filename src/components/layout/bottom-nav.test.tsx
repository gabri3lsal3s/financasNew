import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "./bottom-nav";

vi.mock("@/state", () => ({
  useReminders: () => ({
    totalCount: 0,
    urgentCount: 0,
    items: [],
    isLoading: false,
    error: null,
  }),
  useUserAccess: () => ({
    role: "user",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false,
    hasFeature: () => true,
    isLoading: false,
  }),
}));

function renderNav(entry = "/") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe("BottomNav Dinâmica & Adaptativa", () => {
  it("renderiza exatamente 5 slots (3 itens principais, FAB central e botão Mais) quando houver > 4 itens", () => {
    renderNav();

    const links = screen.getAllByRole("link");
    const names = links.map((link) => link.getAttribute("aria-label") ?? link.textContent?.trim());
    expect(names).toEqual([
      "Início",
      "Transações",
      "Nova transação",
      "Cartões",
      "Mais",
    ]);
  });


  it("FAB central é contextual e preserva a rota ativa: na Início/Transações abre o wizard de lançamento", () => {
    const { unmount } = renderNav("/");
    expect(screen.getByRole("link", { name: "Nova transação" })).toHaveAttribute("href", "/?novo=transacao");
    unmount();

    renderNav("/transacoes");
    expect(screen.getByRole("link", { name: "Nova transação" })).toHaveAttribute("href", "/transacoes?novo=transacao");
  });

  it("FAB central em Cartões abre o wizard de lançamento preservando a rota (/cartoes?novo=transacao)", () => {
    renderNav("/cartoes");
    const fab = screen.getByRole("link", { name: "Nova transação" });
    expect(fab).toHaveAttribute("href", "/cartoes?novo=transacao");
  });

  it("FAB central é contextual: em Dívidas/Categorias abre o formulário correspondente", () => {
    const { unmount } = renderNav("/dividas");
    expect(screen.getByRole("link", { name: "Nova dívida" })).toHaveAttribute("href", "/dividas?novo=divida");
    unmount();

    renderNav("/categorias");
    expect(screen.getByRole("link", { name: "Nova categoria" })).toHaveAttribute("href", "/categorias?novo=categoria");
  });

  it("FAB em Investimentos aponta para ?novo=investimento", () => {
    renderNav("/investments");
    expect(screen.getByRole("link", { name: "Novo investimento" })).toHaveAttribute("href", "/investments?novo=investimento");
  });

  it("rola a página suavemente para o topo ao clicar na aba ativa", () => {
    const originalScrollTo = window.scrollTo;
    window.scrollTo = vi.fn();
    Object.defineProperty(window, "scrollY", { value: 120, configurable: true });

    renderNav("/transacoes");
    const activeTab = screen.getByRole("link", { name: "Transações" });
    fireEvent.click(activeTab);

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    window.scrollTo = originalScrollTo;
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });
});
