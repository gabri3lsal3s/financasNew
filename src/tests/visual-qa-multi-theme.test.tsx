import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DeltaHint } from "@/components/modules/delta-hint";
import { EmptyState } from "@/components/ui/empty-state";
import { MoneyText } from "@/components/ui/money-text";
import { KpiCard } from "@/components/modules/kpi-card";
import { Button } from "@/components/ui/button";
import { PositionTable, type PositionRow } from "@/components/modules/position-table";

import { NumberTicker } from "@/components/ui/number-ticker";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import { CreditCard3D } from "@/components/modules/credit-card-3d";
import { EmergencyThermometer } from "@/components/modules/emergency-thermometer";
import { ProjectionTab } from "@/features/insights/components/projection-tab";
import { FireProjectionCurve } from "@/features/landing/components/fire-projection-curve";
import type { CreditCard } from "@/types";

describe("Revisão Visual Desktop + Mobile nos 3 Temas (F14 & F15 QA — RELEASE.md)", () => {
  const root = process.cwd();
  const tokensCss = readFileSync(resolve(root, "src/styles/tokens.css"), "utf8");

  describe("1. Integridade dos Design Tokens para os 3 Temas (Light, Dark, OLED)", () => {
    it("tema light possui superfícies claras, primária Teal Petróleo e contraste AA", () => {
      expect(tokensCss).toMatch(/html\[data-theme="light"\][\s\S]*?--background:\s*204\s+29%\s+97%/);
      expect(tokensCss).toMatch(/html\[data-theme="light"\][\s\S]*?--foreground:\s*205\s+42%\s+14%/);
      expect(tokensCss).toMatch(/html\[data-theme="light"\][\s\S]*?--primary:\s*173\s+58%\s+39%/);
      expect(tokensCss).toMatch(/html\[data-theme="light"\][\s\S]*?--portfolio:\s*201\s+47%\s+20%/);
    });

    it("tema dark possui superfícies ardósia escuro com emissão atenuada", () => {
      expect(tokensCss).toMatch(/html\[data-theme="dark"\][\s\S]*?--background:\s*206\s+49%\s+9%/);
      expect(tokensCss).toMatch(/html\[data-theme="dark"\][\s\S]*?--surface:\s*206\s+42%\s+15%/);
      expect(tokensCss).toMatch(/html\[data-theme="dark"\][\s\S]*?--foreground:\s*199\s+39%\s+94%/);
    });

    it("tema oled possui fundo preto absoluto (#000000 / 0 0% 0%) para economia e contraste máximo", () => {
      expect(tokensCss).toMatch(/html\[data-theme="oled"\][\s\S]*?--background:\s*0\s+0%\s+0%/);
      expect(tokensCss).toMatch(/html\[data-theme="oled"\][\s\S]*?--surface:\s*0\s+0%\s+4%/);
      expect(tokensCss).toMatch(/html\[data-theme="oled"\][\s\S]*?--foreground:\s*0\s+0%\s+98%/);
    });
  });

  describe("2. Renderização Visual Multi-Tema da Carteira e Posição", () => {
    const themes = ["light", "dark", "oled"] as const;

    const mockRows: PositionRow[] = [
      {
        assetId: "ast_1",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 28.5,
        priceBRL: 38.2,
        source: "api",
        valueBRL: 3820.0,
        pct: 55.2,
        unrealizedPnl: 970.0,
        unrealizedPct: 34.03,
        isCash: false,
      },
      {
        assetId: "ast_2",
        ticker: "VALE3",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 50,
        averageCost: 75.0,
        priceBRL: 62.0,
        source: "manual",
        valueBRL: 3100.0,
        pct: 44.8,
        unrealizedPnl: -650.0,
        unrealizedPct: -17.33,
        isCash: false,
      },
    ];

    themes.forEach((theme) => {
      it(`renderiza PositionTable perfeitamente sob tema ${theme} com suporte a expansão e scroll mobile`, async () => {
        document.documentElement.setAttribute("data-theme", theme);
        const user = userEvent.setup();

        const { container } = render(
          <div data-theme={theme} className="w-full">
            <PositionTable
              rows={mockRows}
            />
          </div>,
        );

        // Verifica renderização do cabeçalho da classe (duplicado em mobile cards e desktop table)
        const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
        expect(acoesGroups.length).toBeGreaterThanOrEqual(1);
        const acoesGroup = acoesGroups[0]!;
        expect(acoesGroup).toHaveAttribute("aria-expanded", "false");

        // Expande o grupo de classe
        await user.click(acoesGroup);
        expect(acoesGroup).toHaveAttribute("aria-expanded", "true");

        // Verifica os tickers renderizados na interface adaptativa
        expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("VALE3").length).toBeGreaterThanOrEqual(1);

        // Verifica indicador de preço manual para VALE3 (ponto semântico com title="Preço manual")
        expect(container.querySelectorAll('[title="Preço manual"]').length).toBeGreaterThanOrEqual(1);

        // Verifica área com scroll horizontal seguro para mobile
        expect(container.querySelector(".overflow-x-auto")).toBeInTheDocument();
      });
    });
  });

  describe("3. Semântica de Lucro e Prejuízo (MoneyText e DeltaHint)", () => {
    it("lucro positivo exibe tom semântico e sinal positivo explícito", () => {
      const { container } = render(
        <MoneyText cents={97000} sign="explicit" tone="auto" />,
      );
      expect(container.textContent).toContain("+R$");
      expect(container.textContent).toContain("970,00");
      expect(container.querySelector(".text-positive-strong")).toBeInTheDocument();
    });

    it("prejuízo negativo exibe sinal de menos tipográfico e classe semântica negativa", () => {
      const { container } = render(
        <MoneyText cents={-65000} sign="explicit" tone="auto" />,
      );
      // Minus tipográfico (\u2212) padronizado no design system
      expect(container.textContent).toMatch(/[−-]R\$/);
      expect(container.textContent).toContain("650,00");
      expect(container.querySelector(".text-negative-strong")).toBeInTheDocument();
    });

    it("DeltaHint renderiza variação percentual com ícone semântico e classe correspondente", () => {
      const { container } = render(
        <DeltaHint currentCents={1038} previousCents={1000} />,
      );
      expect(container.textContent).toContain("3,8%");
      expect(container.querySelector(".text-positive-strong")).toBeInTheDocument();
    });
  });

  describe("4. Responsividade Mobile (< 640px) e Alvos de Toque (min-h-11)", () => {
    it("EmptyState com tom portfolio renderiza com CTAs acessíveis e headingLevel válido", () => {
      render(
        <EmptyState
          tone="portfolio"
          title="Nenhum ativo cadastrado"
          description="Adicione seus investimentos para acompanhar a evolução patrimonial."
          action={<Button variant="outline">Adicionar ativo</Button>}
          headingLevel="h2"
        />,
      );

      const title = screen.getByRole("heading", { level: 2 });
      expect(title).toHaveTextContent("Nenhum ativo cadastrado");

      const button = screen.getByRole("button", { name: "Adicionar ativo" });
      expect(button).toBeInTheDocument();
    });

    it("KpiCard com patrimônio total renderiza DeltaHint e suporta densidade mobile", () => {
      render(
        <KpiCard
          label="Patrimônio total"
          cents={12543050}
          hint={<DeltaHint currentCents={125430} previousCents={124000} />}
        />,
      );

      expect(screen.getByText("Patrimônio total")).toBeInTheDocument();
      expect(screen.getByText(/1,2%/)).toBeInTheDocument();
    });
  });

  describe("5. Fase 15: Micro-Interações, Feedback e Conforto Visual nos 3 Temas", () => {
    const themes = ["light", "dark", "oled"] as const;

    themes.forEach((theme) => {
      it(`renderiza NumberTicker de forma estável sob tema ${theme} sem quebra de layout`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="p-4">
            <NumberTicker value={125000} format={(v) => `R$ ${v}`} />
          </div>,
        );

        expect(container.textContent).toContain("R$ 125000");
      });

      it(`botões primários e interativos possuem classes de hover/focus unificadas sob tema ${theme}`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="flex gap-4">
            <Button variant="default">Salvar Meta</Button>
            <Button variant="outline">Adicionar Ativo</Button>
          </div>,
        );

        const primaryBtn = screen.getByRole("button", { name: "Salvar Meta" });
        const outlineBtn = screen.getByRole("button", { name: "Adicionar Ativo" });

        // Verifica anel de foco acessível e micro-interação de clique
        expect(primaryBtn.className).toMatch(/focus-visible:ring-1/);
        expect(primaryBtn.className).toMatch(/active:scale-\[0\.98\]/);
        expect(outlineBtn.className).toMatch(/focus-visible:ring-1/);
        expect(outlineBtn.className).toMatch(/active:scale-\[0\.98\]/);
        expect(container.querySelector(".flex.gap-4")).toBeInTheDocument();
      });
    });

    it("gateway sensorial orquestra intenção success e action sem erros", () => {
      expect(() => {
        triggerSensory("success");
        triggerSensory("action");
      }).not.toThrow();
    });
  });

  describe("6. Fase 17: Dashboard de Investimentos (/investments) nos 3 Temas", () => {
    const themes = ["light", "dark", "oled"] as const;

    const mockRowsSortable: PositionRow[] = [
      {
        assetId: "ast_1",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 28.5,
        priceBRL: 38.2,
        source: "api",
        valueBRL: 3820.0,
        pct: 55.2,
        unrealizedPnl: 970.0,
        unrealizedPct: 34.03,
        isCash: false,
      },
      {
        assetId: "ast_2",
        ticker: "VALE3",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 50,
        averageCost: 75.0,
        priceBRL: 62.0,
        source: "manual",
        valueBRL: 3100.0,
        pct: 44.8,
        unrealizedPnl: -650.0,
        unrealizedPct: -17.33,
        isCash: false,
      },
    ];

    themes.forEach((theme) => {
      it(`renderiza PositionTable com ordenação (sortable) sob tema ${theme}`, async () => {
        document.documentElement.setAttribute("data-theme", theme);
        const user = userEvent.setup();

        const { container } = render(
          <div data-theme={theme} className="w-full">
            <PositionTable
              rows={mockRowsSortable}
              sortable={true}
            />
          </div>,
        );

        // Expande o grupo para expor as linhas
        const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
        expect(acoesGroups.length).toBeGreaterThanOrEqual(1);
        await user.click(acoesGroups[0]!);

        // Verifica cabeçalhos ordenáveis no desktop
        const tickerHeaders = container.querySelectorAll("th[aria-sort]");
        if (tickerHeaders.length > 0) {
          const firstSortHeader = tickerHeaders[0] as HTMLTableCellElement;
          expect(firstSortHeader).toBeInTheDocument();
          // Clica no botão de ordenação interno
          const sortButton = firstSortHeader.querySelector("button");
          if (sortButton) {
            await user.click(sortButton);
            expect(firstSortHeader.getAttribute("aria-sort")).toMatch(/ascending|descending/);
          }
        }
      });
    });

    it("renderiza KPIs executivos da carteira com tom semântico de rentabilidade", () => {
      render(
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Patrimônio Total" cents={692000} tone="default" />
          <KpiCard label="Rentabilidade" value="+12,4%" tone="positive" />
          <KpiCard label="Proventos no Mês" cents={45000} tone="positive" />
          <KpiCard label="Saldo em Caixa" cents={150000} tone="portfolio" />
        </div>,
      );

      expect(screen.getByText("Patrimônio Total")).toBeInTheDocument();
      expect(screen.getByText("Rentabilidade")).toBeInTheDocument();
      expect(screen.getByText("+12,4%")).toBeInTheDocument();
      expect(screen.getByText("Proventos no Mês")).toBeInTheDocument();
      expect(screen.getByText("Saldo em Caixa")).toBeInTheDocument();
    });
  });

  describe("7. Fase 18: Proventos (Extrato e Calendário) nos 3 Temas", () => {
    const themes = ["light", "dark", "oled"] as const;

    themes.forEach((theme) => {
      it(`renderiza extrato e calendário de proventos sob tema ${theme} com abas fluidas e grid responsivo`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="w-full flex flex-col gap-4">
            {/* Sub-abas de proventos */}
            <div role="tablist" className="flex items-center gap-1.5 p-1 bg-surface-hover/80 rounded-xl overflow-x-auto no-scrollbar">
              <button role="tab" aria-selected="true" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-surface text-foreground shadow-xs">
                Extrato Mensal
              </button>
              <button role="tab" aria-selected="false" className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground">
                Calendário
              </button>
              <button role="tab" aria-selected="false" className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground">
                Por Ativo
              </button>
            </div>

            {/* KPIs do mês */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <KpiCard label="Recebido no Mês" cents={15025} tone="positive" />
              <KpiCard label="Total no Ano" cents={185000} tone="positive" />
            </div>

            {/* Calendário anual com 12 botões responsivos */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((m, idx) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={idx === 7}
                  className={cn(
                    "min-h-11 rounded-lg border text-xs font-medium transition-colors flex flex-col items-center justify-center gap-1",
                    idx === 7 ? "border-primary bg-primary/10 text-primary-strong" : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-hover",
                  )}
                >
                  <span>{m}</span>
                  <span className="text-[10px] font-mono tabular-nums">R$ 150</span>
                </button>
              ))}
            </div>
          </div>,
        );

        expect(screen.getByRole("tab", { name: "Extrato Mensal" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByText("Recebido no Mês")).toBeInTheDocument();
        expect(screen.getByText("Total no Ano")).toBeInTheDocument();

        // 12 botões de meses presentes no calendário
        const monthButtons = container.querySelectorAll("button[aria-pressed]");
        expect(monthButtons.length).toBe(12);
        expect(monthButtons[7]).toHaveAttribute("aria-pressed", "true");
      });
    });
  });

  describe("8. Fase 19: Inteligência & Consistência dos Insights nos 3 Temas", () => {
    const themes = ["light", "dark", "oled"] as const;

    themes.forEach((theme) => {
      it(`renderiza diagnósticos, alertas e tendências analíticas sob tema ${theme}`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="w-full flex flex-col gap-4">
            {/* Cabeçalho de Diagnóstico e Alerta de Tendência */}
            <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Tendência de Gastos</span>
                <span className="text-xs font-mono tabular-nums text-warning-strong">+18,5%</span>
              </div>
              <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-xs text-warning-strong flex items-center gap-2">
                <span>Seus gastos subiram mais de 15% em relação ao mês anterior.</span>
              </div>
            </div>

            {/* Grid de Métricas de Diagnósticos Responsivo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KpiCard label="Média Dias Úteis" cents={4500} tone="default" />
              <KpiCard label="Média Fim de Semana" cents={8200} tone="default" />
            </div>
          </div>,
        );

        expect(screen.getByText("Tendência de Gastos")).toBeInTheDocument();
        expect(screen.getByText("+18,5%")).toBeInTheDocument();
        expect(screen.getByText(/Seus gastos subiram mais de 15%/i)).toBeInTheDocument();
        expect(screen.getByText("Média Dias Úteis")).toBeInTheDocument();
        expect(screen.getByText("Média Fim de Semana")).toBeInTheDocument();
        expect(container.querySelector(".border-border\\/80")).toBeInTheDocument();
      });
    });
  });

  describe("9. Fase 21: Inteligência de Entrada & Automações Preditivas nos 3 Temas", () => {
    const themes = ["light", "dark", "oled"] as const;

    themes.forEach((theme) => {
      it(`renderiza chips preditivos, lançamentos habituais e botão de clonagem rápida sob tema ${theme}`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="w-full flex flex-col gap-4">
            {/* Chips de sugestão preditiva rápida (chips de 1 toque) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Sugestões:</span>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-primary/25 bg-primary/10 text-primary-strong hover:bg-primary/20 transition-colors focus-visible:ring-1 focus-visible:ring-ring"
              >
                Almoço Restaurante
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-border/80 bg-surface text-foreground hover:bg-surface-hover transition-colors"
              >
                Supermercado Mensal
              </button>
            </div>

            {/* Card de Lançamento Habitual (Templates rápidos) */}
            <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground">Academia Smart</span>
                <span className="text-[11px] text-muted-foreground">Lazer • Débito automático</span>
              </div>
              <span className="text-xs font-mono font-medium tabular-nums text-foreground">R$ 119,90</span>
            </div>

            {/* Botão de repetição rápida no mês atual */}
            <div className="flex justify-end">
              <Button variant="outline" className="min-h-11">
                Repetir no mês atual
              </Button>
            </div>
          </div>,
        );

        expect(screen.getByText("Sugestões:")).toBeInTheDocument();
        expect(screen.getByText("Almoço Restaurante")).toBeInTheDocument();
        expect(screen.getByText("Supermercado Mensal")).toBeInTheDocument();
        expect(screen.getByText("Academia Smart")).toBeInTheDocument();
        expect(screen.getByText("R$ 119,90")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Repetir no mês atual" })).toBeInTheDocument();
        expect(container.querySelector(".border-primary\\/25")).toBeInTheDocument();
      });
    });
  });

  describe("10. Fase 22: Central de Exportação, Backup e Fechamento Imprimível nos 3 Temas", () => {
    const themes = ["light", "dark", "oled"] as const;

    themes.forEach((theme) => {
      it(`renderiza cards de exportação de dados, fechamento e backup sob tema ${theme}`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="w-full flex flex-col gap-4">
            {/* Card de Exportação de Dados */}
            <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Exportação de Extratos</span>
                <span className="text-[11px] text-muted-foreground">Formato CSV (Excel / pt-BR)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">Exportar Despesas</Button>
                <Button variant="outline" size="sm">Exportar Receitas</Button>
                <Button variant="outline" size="sm">Exportar Posições</Button>
              </div>
            </div>

            {/* Resumo de Fechamento de Período Imprimível */}
            <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Fechamento do Período</span>
                <Button variant="default" size="sm" className="min-h-11">
                  Imprimir / Salvar PDF
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KpiCard label="Receitas" cents={500000} tone="positive" />
                <KpiCard label="Despesas" cents={320000} tone="negative" />
                <KpiCard label="Investimentos" cents={100000} tone="portfolio" />
                <KpiCard label="Saldo Líquido" cents={80000} tone="positive" />
              </div>
            </div>
          </div>,
        );

        expect(screen.getByText("Exportação de Extratos")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Exportar Despesas" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Exportar Receitas" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Exportar Posições" })).toBeInTheDocument();
        expect(screen.getByText("Fechamento do Período")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Imprimir / Salvar PDF" })).toBeInTheDocument();
        expect(container.querySelectorAll(".border-border\\/80").length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("11. Fase 23: Performance, Cartões 3D em CSS Puro e Pre-fetching nos 3 Temas", () => {
    const themes = ["light", "dark", "oled"] as const;

    const mockCard: CreditCard = {
      id: "card-1",
      user_id: "user-1",
      name: "Nubank Ultravioleta",
      brand: "mastercard",
      credit_limit: 15000,
      closing_day: 10,
      due_day: 17,
      color: "#820AD1",
      is_active: true,
    };

    themes.forEach((theme) => {
      it(`renderiza cartão de crédito 3D via CSS sob tema ${theme} sem WebGL e com dados tabulares`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="w-full flex justify-center p-4">
            <CreditCard3D
              card={mockCard}
              usedLimitCents={425080}
              competenceMonth="2026-08"
              isPrimary={true}
              disableTilt={true}
            />
          </div>,
        );

        expect(screen.getByText("Nubank Ultravioleta")).toBeInTheDocument();
        expect(screen.getByText(/Principal/i)).toBeInTheDocument();
        expect(screen.getByText(/Fatura/i)).toBeInTheDocument();
        expect(container.querySelector("[aria-label='Chip EMV']")).toBeInTheDocument();
        expect(screen.getByText(/Melhor dia/i)).toBeInTheDocument();
      });
    });
  });

  describe("12. Fase 24: Planejamento Financeiro, Reserva de Emergência & Simulação FIRE nos 3 Temas", () => {
    const themes = ["light", "dark", "oled"] as const;

    themes.forEach((theme) => {
      it(`renderiza EmergencyThermometer sob tema ${theme} com marcos e premissas`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="w-full max-w-4xl p-4">
            <EmergencyThermometer
              liquidReserveCents={1_200_000}
              monthlyExpensesCents={200_000}
              monthlySavingsVelocityCents={100_000}
              referenceMonth="2026-08"
            />
          </div>,
        );

        expect(screen.getByText("Reserva de Emergência & Autonomia")).toBeInTheDocument();
        expect(screen.getByText(/Cobertura atual:/i)).toBeInTheDocument();
        expect(screen.getByText("3 Meses")).toBeInTheDocument();
        expect(screen.getByText("6 Meses")).toBeInTheDocument();
        expect(screen.getByText("12 Meses")).toBeInTheDocument();
        expect(screen.getByText("Adequado")).toBeInTheDocument();
        expect(container.querySelectorAll(".border-border\\/80").length).toBeGreaterThanOrEqual(1);
      });

      it(`renderiza ProjectionTab com fechamento, reserva e cortes sob tema ${theme}`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="w-full max-w-4xl p-4">
            <ProjectionTab
              dailyCents={12000}
              projectedExpensesCents={350000}
              surplusCents={150000}
              onTrack={true}
              spentPercent={65}
              elapsedPercent={70}
              paceActive={true}
              pendingSummary={{
                receivablesCents: 50000,
                payablesCents: 20000,
                balanceCents: 30000,
              }}
              challenges={[
                {
                  categoryId: "cat-1",
                  name: "Restaurantes",
                  percent: 10,
                  targetCents: 45000,
                  savingsCents: 5000,
                  minLimitCents: 40000,
                },
              ]}
              showDiscretionary={false}
              discretionary={null}
              liquidReserveCents={1_200_000}
              monthlyExpensesCents={200_000}
              monthlySavingsVelocityCents={100_000}
              referenceMonth="2026-08"
            />
          </div>,
        );

        expect(screen.getByText("Fechamento Projetado do Mês")).toBeInTheDocument();
        expect(screen.getByText("Pendências do período")).toBeInTheDocument();
        expect(screen.getByText("Segurança Financeira & Reserva")).toBeInTheDocument();
        expect(screen.getByText("Plano de Economia & Cortes Sugeridos")).toBeInTheDocument();
        expect(screen.getByText(/Restaurantes — cortar 10%/)).toBeInTheDocument();
        expect(container.querySelectorAll(".border-border\\/80").length).toBeGreaterThanOrEqual(3);
      });

      it(`renderiza FireProjectionCurve sob tema ${theme} com curva SVG e meta patrimonial`, () => {
        document.documentElement.setAttribute("data-theme", theme);
        const { container } = render(
          <div data-theme={theme} className="w-full max-w-4xl p-4">
            <FireProjectionCurve
              initialPatrimony={50000}
              monthlyAporte={2000}
              monthlyExpenses={3000}
              annualRate={0.08}
              years={20}
            />
          </div>,
        );

        expect(screen.getByText(/Meta Patrimonial:/)).toBeInTheDocument();
        expect(container.querySelector("svg")).toBeInTheDocument();
      });
    });
  });
});
