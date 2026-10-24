import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { TermsPage } from "./terms-page";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("TermsPage (Contrato 1: Termos de Serviço SaaS)", () => {
  it("renderiza o cabeçalho e título oficial do contrato de adesão", () => {
    renderWithRouter(<TermsPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Termos de Serviço e Contrato de Adesão SaaS",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/23 de Outubro de 2026/)).toBeInTheDocument();
    expect(screen.getByText("Versão 2.0")).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(INSTITUTIONAL_CONFIG.appName)).length).toBeGreaterThanOrEqual(1);
  });

  it("materializa a Cláusula Primeira com o fornecedor oficial, CNPJ e modelo Online First", () => {
    renderWithRouter(<TermsPage />);

    const section = document.getElementById("clausula-1")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /CLÁUSULA PRIMEIRA — DO OBJETO E DA NATUREZA DOS SERVIÇOS/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(new RegExp(INSTITUTIONAL_CONFIG.companyName))).toBeInTheDocument();
    expect(scope.getByText(new RegExp(INSTITUTIONAL_CONFIG.cnpj))).toBeInTheDocument();
    expect(scope.getByText(/Online First/i)).toBeInTheDocument();
    expect(scope.getByText(/sincronização em nuvem/i)).toBeInTheDocument();
  });

  it("materializa a Cláusula Terceira com 30 dias de trial sem cartão de crédito e modo somente-leitura", () => {
    renderWithRouter(<TermsPage />);

    const section = document.getElementById("clausula-3")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /CLÁUSULA TERCEIRA — DO PERÍODO DE AVALIAÇÃO GRATUITA \(TRIAL\)/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/30 \(trinta\) dias de avaliação gratuita/i)).toBeInTheDocument();
    expect(scope.getByText(/não exige a inserção de dados de cartão de crédito/i)).toBeInTheDocument();
    expect(scope.getByText(/Modo Somente-Leitura/i)).toBeInTheDocument();
  });

  it("materializa a Cláusula Quarta com preços dos planos Pro Mensal e Pro Anual", () => {
    renderWithRouter(<TermsPage />);

    const section = document.getElementById("clausula-4")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /CLÁUSULA QUARTA — DOS PLANOS PAGOS, PREÇOS E FATURAMENTO/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/R\$ 19,90 por mês/i)).toBeInTheDocument();
    expect(scope.getByText(/R\$ 178,80 por ano/i)).toBeInTheDocument();
  });

  it("materializa a Cláusula Quinta com o Direito de Arrependimento de 7 dias e estorno integral (CDC Art. 49)", () => {
    renderWithRouter(<TermsPage />);

    const section = document.getElementById("clausula-5")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /CLÁUSULA QUINTA — DO DIREITO DE ARREPENDIMENTO \(CDC ART\. 49\)/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/7 \(sete\) dias corridos/i)).toBeInTheDocument();
    expect(
      scope.getByText(/reembolso integral e imediato de todos os valores cobrados/i),
    ).toBeInTheDocument();
    expect(scope.getByText(INSTITUTIONAL_CONFIG.supportEmail)).toBeInTheDocument();
  });

  it("materializa a Cláusula Sexta com cancelamento em 1 clique sem multas nem fidelidade", () => {
    renderWithRouter(<TermsPage />);

    const section = document.getElementById("clausula-6")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /CLÁUSULA SEXTA — DO CANCELAMENTO SEM BUROCRACIA E SEM MULTAS/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/1 clique/i)).toBeInTheDocument();
    expect(scope.getByText(/não gera multas rescisórias/i)).toBeInTheDocument();
  });

  it("materializa a Cláusula Sétima com isenção CVM 19/2021 e 20/2021", () => {
    renderWithRouter(<TermsPage />);

    const section = document.getElementById("clausula-7")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /CLÁUSULA SÉTIMA — DA ISENÇÃO DE CUSTÓDIA, INTERMEDIAÇÃO E CONSULTORIA \(CVM\)/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/não é instituição financeira/i)).toBeInTheDocument();
    expect(scope.getByText(/Resolução CVM nº 19\/2021/i)).toBeInTheDocument();
    expect(scope.getByText(/Resolução CVM nº 20\/2021/i)).toBeInTheDocument();
    expect(scope.getByText(/estritamente matemático e automatizado/i)).toBeInTheDocument();
  });

  it("materializa a Cláusula Oitava com isenção contábil (CFC) e tributária (Receita Federal)", () => {
    renderWithRouter(<TermsPage />);

    const section = document.getElementById("clausula-8")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /CLÁUSULA OITAVA — DA ISENÇÃO DE RESPONSABILIDADE TRIBUTÁRIA E CONTÁBIL/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/Conselho Federal de Contabilidade \(CFC\)/i)).toBeInTheDocument();
    expect(scope.getByText(/Receita Federal do Brasil \(RFB\)/i)).toBeInTheDocument();
    expect(scope.getByText(/código 6015/i)).toBeInTheDocument();
  });

  it("materializa a Cláusula Nona com foro de eleição oficial", () => {
    renderWithRouter(<TermsPage />);

    const section = document.getElementById("clausula-9")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /CLÁUSULA NONA — DO FORO DE ELEIÇÃO/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(new RegExp(INSTITUTIONAL_CONFIG.legalJurisdiction))).toBeInTheDocument();
  });

  it("passa na auditoria de acessibilidade automatizada (axe)", async () => {
    const { container } = renderWithRouter(<TermsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
