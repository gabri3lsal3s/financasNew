import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DeepDiveTabsSection } from "./deep-dive-tabs-section";

describe("DeepDiveTabsSection", () => {
  it("renderiza Investimentos & Preço Teto por padrão com troca de modelos Bazin/Graham/Gordon/FIIs", async () => {
    const user = userEvent.setup();
    render(<DeepDiveTabsSection />);

    expect(screen.getByTestId("deep-dive-investments")).toBeInTheDocument();
    expect(screen.getByTestId("valuation-interactive-preview")).toBeInTheDocument();
    expect(screen.getByText("Metas Hierárquicas: Classe para Ativo")).toBeInTheDocument();
    expect(screen.getByText("8,8 / 10 · Tese revisada")).toBeInTheDocument();

    // Alterna para Graham e depois para FIIs (HGLG11)
    await user.click(screen.getByRole("button", { name: /Graham/i }));
    expect(screen.getByText(/VI = Raiz\(22,5 x LPA x VPA\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /FIIs/i }));
    expect(screen.getAllByText(/HGLG11/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/P\/VP 0,98 · Atrativo/i)).toBeInTheDocument();
  });

  it("permite navegar para Relatórios & Memória de Cálculo sem menções a IRPF", async () => {
    const user = userEvent.setup();
    render(<DeepDiveTabsSection />);

    await user.click(screen.getByRole("tab", { name: /Relatórios/i }));
    expect(await screen.findByTestId("deep-dive-reports")).toBeInTheDocument();
    expect(screen.getByTestId("report-preview-dre")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Lâmina \(TWR\)/i }));
    expect(screen.getByTestId("report-preview-tearsheet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Balanço/i }));
    expect(screen.getByTestId("report-preview-balance")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Proventos & \.xlsx/i }));
    expect(screen.getByTestId("report-preview-dividends")).toBeInTheDocument();
    expect(screen.getByText("5 abas padronizadas")).toBeInTheDocument();

    expect(
      screen.getByText("Zero Caixa Preta — Memória de Cálculo em 12 Módulos"),
    ).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Viagens & Rateio em Grupo")).toBeInTheDocument();

    expect(
      screen.queryByText(/IRPF|Imposto de Renda|Facilitador de IRPF/i),
    ).not.toBeInTheDocument();
  });

  it("permite navegar para Radar Preventivo & Privacidade exibindo os pilares de inteligência e blindagem de dados", async () => {
    const user = userEvent.setup();

    render(<DeepDiveTabsSection />);

    await user.click(screen.getByRole("tab", { name: /Radar Preventivo & Privacidade/i }));
    expect(await screen.findByTestId("deep-dive-security")).toBeInTheDocument();
    expect(screen.getByText("Inteligência Preventiva & Radar Diário")).toBeInTheDocument();
    expect(screen.getByText("Segurança, Privacidade & Controle dos Dados")).toBeInTheDocument();
    expect(screen.getByText("Zero Senhas Bancárias")).toBeInTheDocument();
    expect(screen.getByText("Autenticação 2FA (MFA) & Sessões Ativas")).toBeInTheDocument();
    expect(screen.getByText("Isolamento RLS & Soberania LGPD")).toBeInTheDocument();
  });
});
