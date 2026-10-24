import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { PrivacyPage } from "./privacy-page";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("PrivacyPage (Contrato 2: Política de Privacidade LGPD)", () => {
  it("renderiza o cabeçalho e título oficial da política de privacidade", () => {
    renderWithRouter(<PrivacyPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Política de Privacidade e Proteção de Dados (LGPD)",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/23 de Outubro de 2026/)).toBeInTheDocument();
    expect(screen.getByText("Versão 2.0")).toBeInTheDocument();
  });

  it("materializa a Seção 1 com o Controlador oficial, CNPJ e canal do DPO", () => {
    renderWithRouter(<PrivacyPage />);

    const section = document.getElementById("secao-1")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /SEÇÃO 1 — IDENTIFICAÇÃO DO CONTROLADOR E DO ENCARREGADO \(DPO\)/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(new RegExp(INSTITUTIONAL_CONFIG.companyName))).toBeInTheDocument();
    expect(scope.getByText(new RegExp(INSTITUTIONAL_CONFIG.cnpj))).toBeInTheDocument();

    const dpoLink = scope.getByRole("link", { name: INSTITUTIONAL_CONFIG.dpoEmail });
    expect(dpoLink).toHaveAttribute("href", `mailto:${INSTITUTIONAL_CONFIG.dpoEmail}`);
  });

  it("materializa a Seção 2 com as bases legais do Artigo 7º e 11 da LGPD", () => {
    renderWithRouter(<PrivacyPage />);

    const section = document.getElementById("secao-2")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /SEÇÃO 2 — BASES LEGAIS E FINALIDADES DO TRATAMENTO \(LGPD ART\. 7º E 11\)/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/Identificação, Autenticação e Gestão de Acesso/i)).toBeInTheDocument();
    expect(scope.getByText(/Dados Financeiros e Patrimoniais/i)).toBeInTheDocument();
    expect(scope.getByText(/Captura Passiva de Notificações Bancárias/i)).toBeInTheDocument();
    expect(scope.getByText(/Registros de Acesso a Aplicações/i)).toBeInTheDocument();
  });

  it("materializa a Seção 3 com arquitetura de Privacy by Design (RLS, on-device e FLAG_SECURE)", () => {
    renderWithRouter(<PrivacyPage />);

    const section = document.getElementById("secao-3")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /SEÇÃO 3 — ARQUITETURA DE PRIVACIDADE POR DESIGN \(PRIVACY BY DESIGN\)/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/Row Level Security \(RLS\)/i)).toBeInTheDocument();
    expect(scope.getByText(/34 tabelas/i)).toBeInTheDocument();
    expect(scope.getByText(/Processamento 100% On-Device de Notificações/i)).toBeInTheDocument();
    expect(scope.getByText(/FLAG_SECURE/i)).toBeInTheDocument();
    expect(scope.getByText(/\[REDACTED_CPF\]/i)).toBeInTheDocument();
  });

  it("materializa a Seção 4 com os direitos do titular (Art. 18) e prazo de até 15 dias (Art. 19, II)", () => {
    renderWithRouter(<PrivacyPage />);

    const section = document.getElementById("secao-4")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /SEÇÃO 4 — DOS DIREITOS DO TITULAR DE DADOS \(LGPD ART\. 18\)/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/Confirmação da existência de tratamento e acesso facilitado/i)).toBeInTheDocument();
    expect(scope.getByText(/Portabilidade dos dados a outro fornecedor/i)).toBeInTheDocument();
    expect(scope.getByText(/até 15 \(quinze\) dias/i)).toBeInTheDocument();
  });

  it("materializa a Seção 5 com direito ao esquecimento e retenção de logs por 6 meses (Marco Civil Art. 15)", () => {
    renderWithRouter(<PrivacyPage />);

    const section = document.getElementById("secao-5")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /SEÇÃO 5 — DO DIREITO AO ESQUECIMENTO E RETENÇÃO LEGAL COMPULSÓRIA/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/Autoatendimento de Exclusão de Conta/i)).toBeInTheDocument();
    expect(scope.getByText(/6 \(seis\) meses/i)).toBeInTheDocument();
    expect(scope.getByText(/Artigo 15 da Lei Federal nº 12\.965\/2014/i)).toBeInTheDocument();
  });

  it("materializa a Seção 6 com política de cookies estritamente técnicos sem publicidade", () => {
    renderWithRouter(<PrivacyPage />);

    const section = document.getElementById("secao-6")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /SEÇÃO 6 — POLÍTICA DE COOKIES E DADOS LOCAIS/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByText(/não comercializa dados de seus usuários/i)).toBeInTheDocument();
  });

  it("materializa a Seção 7 com atalhos de autoatendimento e contato DPO com assunto predefinido", () => {
    renderWithRouter(<PrivacyPage />);

    const section = document.getElementById("secao-7")?.closest("section");
    expect(section).toBeInTheDocument();

    const scope = within(section!);
    expect(
      scope.getByRole("heading", {
        level: 2,
        name: /SEÇÃO 7 — CANAL DE AUTOATENDIMENTO DO TITULAR E CONTATO DO DPO/i,
      }),
    ).toBeInTheDocument();

    expect(scope.getByRole("button", { name: /exportar meus dados/i })).toBeInTheDocument();
    expect(scope.getByRole("button", { name: /gerenciar exclusão/i })).toBeInTheDocument();

    const dpoReqLink = scope.getByRole("link", { name: /enviar requerimento/i });
    expect(dpoReqLink).toHaveAttribute(
      "href",
      `mailto:${INSTITUTIONAL_CONFIG.dpoEmail}?subject=%5BLGPD%5D%20Requisicao%20de%20Direitos%20do%20Titular`,
    );
  });

  it("passa na auditoria de acessibilidade automatizada (axe)", async () => {
    const { container } = renderWithRouter(<PrivacyPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
