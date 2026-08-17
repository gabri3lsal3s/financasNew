import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { BottomNav } from "./bottom-nav";

function renderNav(entry = "/") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe("BottomNav 5 slots (F7.1)", () => {
  it("renderiza os 5 slots na ordem: Início, Transações, FAB Novo, Cartões, Mais", () => {
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

  it("FAB central é contextual: na Início/Transações abre o wizard de lançamento", () => {
    renderNav("/");
    expect(screen.getByRole("link", { name: "Nova transação" })).toHaveAttribute("href", "/transacoes/novo");
  });

  it("FAB central em Cartões abre o wizard de lançamento (/transacoes/novo)", () => {
    renderNav("/cartoes");
    const fab = screen.getByRole("link", { name: "Nova transação" });
    expect(fab).toHaveAttribute("href", "/transacoes/novo");
  });

  it("FAB central é contextual: em Dívidas/Categorias abre o formulário correspondente", () => {
    const { unmount } = renderNav("/dividas");
    expect(screen.getByRole("link", { name: "Nova dívida" })).toHaveAttribute("href", "/dividas?novo=divida");
    unmount();

    renderNav("/categorias");
    expect(screen.getByRole("link", { name: "Nova categoria" })).toHaveAttribute("href", "/categorias?novo=categoria");
  });

  it("FAB central cai no wizard de lançamento em páginas sem criação própria", () => {
    renderNav("/orcamentos");
    expect(screen.getByRole("link", { name: "Nova transação" })).toHaveAttribute("href", "/transacoes/novo");
  });

  it("Relatórios não ocupa slot da BottomNav (migrou para o menu Mais)", () => {
    renderNav();
    expect(screen.queryByRole("link", { name: "Relatórios" })).not.toBeInTheDocument();
  });

  it("cada slot garante área de toque mínima de 44px (min-h-11)", () => {
    renderNav();
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
    }
  });

  it("destaca o slot ativo da rota atual", () => {
    renderNav("/transacoes");
    const link = screen.getByRole("link", { name: "Transações" });
    expect(link.className).toContain("text-primary-strong");
    expect(screen.getByRole("link", { name: "Início" }).className).not.toContain(
      "text-primary-strong",
    );
  });
});
