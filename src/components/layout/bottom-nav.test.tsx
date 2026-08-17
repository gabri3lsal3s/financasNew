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

  it("FAB central é contextual e preserva a rota ativa: na Início/Transações abre o wizard de lançamento", () => {
    const { unmount } = renderNav("/");
    expect(screen.getByRole("link", { name: "Nova transação" })).toHaveAttribute("href", "/?novo=transacao");
    unmount();

    renderNav("/transacoes");
    expect(screen.getByRole("link", { name: "Nova transação" })).toHaveAttribute("href", "/transacoes?novo=transacao");
  });

  it("FAB central em Cartões abre a criação de cartão preservando a rota (/cartoes?novo=cartao)", () => {
    renderNav("/cartoes");
    const fab = screen.getByRole("link", { name: "Novo cartão" });
    expect(fab).toHaveAttribute("href", "/cartoes?novo=cartao");
  });

  it("FAB central é contextual: em Dívidas/Categorias abre o formulário correspondente", () => {
    const { unmount } = renderNav("/dividas");
    expect(screen.getByRole("link", { name: "Nova dívida" })).toHaveAttribute("href", "/dividas?novo=divida");
    unmount();

    renderNav("/categorias");
    expect(screen.getByRole("link", { name: "Nova categoria" })).toHaveAttribute("href", "/categorias?novo=categoria");
  });

  it("FAB central cai no wizard de lançamento mantendo a rota ativa em páginas sem criação própria", () => {
    const { unmount } = renderNav("/orcamentos");
    expect(screen.getByRole("link", { name: "Nova transação" })).toHaveAttribute("href", "/orcamentos?novo=transacao");
    unmount();

    renderNav("/transacoes?month=2026-08");
    expect(screen.getByRole("link", { name: "Nova transação" })).toHaveAttribute("href", "/transacoes?month=2026-08&novo=transacao");
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
