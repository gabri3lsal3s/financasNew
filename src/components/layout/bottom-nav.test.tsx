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
}));

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
    unmount();

    renderNav("/investments");
    expect(screen.getByRole("link", { name: "Novo investimento" })).toHaveAttribute("href", "/investments?novo=investimento");
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

  it("ao clicar na aba já ativa, dispara scrollToTop", () => {
    const main = document.createElement("main");
    main.id = "main-content";
    main.scrollTop = 300;
    main.scrollTo = vi.fn();
    document.body.appendChild(main);

    renderNav("/transacoes");
    const link = screen.getByRole("link", { name: "Transações" });
    fireEvent.click(link);

    expect(main.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("exibe o ícone correspondente e ativa o slot Mais quando em subpáginas do Mais", () => {
    const routesAndIcons = [
      { path: "/dividas", iconClass: "lucide-hand-coins", label: "Mais (Dívidas)" },
      { path: "/investments", iconClass: "lucide-chart-line", label: "Mais (Investimentos)" },
      { path: "/relatorios", iconClass: "lucide-chart-pie", label: "Mais (Relatórios)" },
      { path: "/insights", iconClass: "lucide-lightbulb", label: "Mais (Insights)" },
      { path: "/orcamentos", iconClass: "lucide-piggy-bank", label: "Mais (Categorias)" },
      { path: "/lembretes", iconClass: "lucide-bell", label: "Mais (Lembretes)" },
      { path: "/configuracoes", iconClass: "lucide-settings", label: "Mais (Configurações)" },
    ];

    for (const { path, iconClass, label } of routesAndIcons) {
      const { container, unmount } = renderNav(path);
      const moreLink = screen.getByRole("link", { name: label });
      expect(moreLink).toHaveClass("text-primary-strong");
      expect(container.querySelector(`.${iconClass}`)).toBeInTheDocument();
      unmount();
    }
  });

  it("exibe os 3 pontinhos (Ellipsis) no slot Mais quando em páginas principais ou na própria /mais", () => {
    const { container: rootContainer, unmount: unmountRoot } = renderNav("/");
    const rootMoreLink = screen.getByRole("link", { name: "Mais" });
    expect(rootMoreLink).not.toHaveClass("text-primary-strong");
    expect(rootContainer.querySelector(".lucide-ellipsis")).toBeInTheDocument();
    unmountRoot();

    const { container: moreContainer, unmount: unmountMore } = renderNav("/mais");
    const moreMenuLink = screen.getByRole("link", { name: "Mais" });
    expect(moreMenuLink).toHaveClass("text-primary-strong");
    expect(moreContainer.querySelector(".lucide-ellipsis")).toBeInTheDocument();
    unmountMore();
  });
});
