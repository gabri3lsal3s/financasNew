import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  CardsSkeleton,
  DebtsSkeleton,
  OverviewSkeleton,
  RouteSkeletonFallback,
  SettingsSkeleton,
  Skeleton,
  SkeletonChart,
  SkeletonKpi,
  SkeletonList,
  SkeletonTable,
  TargetsSkeleton,
} from "./skeleton";

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

  it("SkeletonKpi renderiza no formato canônico de card KPI com Zero CLS", () => {
    const { container } = render(<SkeletonKpi />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("rounded-2xl", "bg-surface", "shadow-xs");
    expect(card.querySelectorAll(".animate-shimmer")).toHaveLength(3);
  });

  it("SkeletonChart e SkeletonTable renderizam nos formatos estruturados de Zero CLS", () => {
    const { container: chartContainer } = render(<SkeletonChart />);
    expect(chartContainer.querySelector("[aria-hidden='true']")).toHaveClass("rounded-2xl", "bg-surface");
    expect(chartContainer.querySelectorAll(".animate-shimmer")).toHaveLength(6);

    const { container: tableContainer } = render(<SkeletonTable rows={4} />);
    expect(tableContainer.querySelector("[aria-hidden='true']")).toHaveClass("rounded-2xl", "bg-surface");
    // Table: 2 blocos no cabeçalho + 4 linhas (4 subelementos cada) = 18 blocos
    expect(tableContainer.querySelectorAll(".animate-shimmer")).toHaveLength(2 + 4 * 4);
  });

  it("CardsSkeleton e DebtsSkeleton renderizam com rótulos e estrutura acessível", () => {
    render(<CardsSkeleton />);
    expect(screen.getByLabelText("Carregando Cartões")).toBeInTheDocument();

    render(<DebtsSkeleton />);
    expect(screen.getByLabelText("Carregando Contas e Dívidas")).toBeInTheDocument();
  });

  it("OverviewSkeleton espelha a estrutura da Home com MonthPicker, Hero, 4 KPIs e 2 gráficos", () => {
    const { container } = render(<OverviewSkeleton />);
    const root = screen.getByLabelText("Carregando Visão Geral");
    expect(root).toBeInTheDocument();
    // 4 KPIs em grid de 4 colunas no desktop + 2 gráficos em grid de 2 colunas
    const kpiGrid = container.querySelector(".lg\\:grid-cols-4");
    expect(kpiGrid?.children).toHaveLength(4);
    const chartGrid = container.querySelector(".lg\\:grid-cols-2");
    expect(chartGrid?.children).toHaveLength(2);
  });

  it("TargetsSkeleton renderiza com rótulo acessível e estrutura canônica de cards", () => {
    const { container } = render(<TargetsSkeleton />);
    expect(screen.getByLabelText("Carregando Metas de Alocação")).toBeInTheDocument();
    expect(container.querySelector("[data-tour='targets-classes-card']")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-surface, .bg-surface\\/90").length).toBeGreaterThanOrEqual(2);
  });

  it("RouteSkeletonFallback renderiza o esqueleto correto baseado na rota", () => {
    render(
      <MemoryRouter initialEntries={["/transacoes"]}>
        <RouteSkeletonFallback />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Carregando Transações")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("SettingsSkeleton renderiza 6 abas e RouteSkeletonFallback mapeia novas rotas", () => {
    const { unmount } = render(<SettingsSkeleton />);
    const tabsRow = screen.getByTestId("settings-skeleton-tabs");
    expect(tabsRow.children).toHaveLength(6);
    unmount();

    const routeExpectations = [
      { path: "/viagens", label: "Carregando Viagens" },
      { path: "/familia", label: "Carregando Orçamento Familiar" },
      { path: "/modo-familia", label: "Carregando Orçamento Familiar" },
      { path: "/insights", label: "Carregando Insights" },
      { path: "/lembretes", label: "Carregando Lembretes" },
      { path: "/investimentos", label: "Carregando Investimentos" },
    ];

    for (const entry of routeExpectations) {
      const view = render(
        <MemoryRouter initialEntries={[entry.path]}>
          <RouteSkeletonFallback />
        </MemoryRouter>,
      );
      expect(screen.getByLabelText(entry.label)).toBeInTheDocument();
      view.unmount();
    }
  });
});
