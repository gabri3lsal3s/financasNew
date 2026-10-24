import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { LegalPageShell } from "./legal-page-shell";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("LegalPageShell", () => {
  it("renderiza o cabeçalho institucional com marca, abas e ações", () => {
    renderWithRouter(
      <LegalPageShell
        activeTab="terms"
        title="Termos de Serviço"
        description="Condições contratuais para uso da plataforma."
        lastUpdated="23 de Outubro de 2026"
        version="2.0"
      >
        <p>Conteúdo de teste das cláusulas contratuais.</p>
      </LegalPageShell>,
    );

    // Marca no cabeçalho
    expect(screen.getByRole("link", { name: /ir para a página inicial/i })).toBeInTheDocument();

    // Abas de navegação
    const termsLinks = screen.getAllByRole("link", { name: /termos de uso/i });
    expect(termsLinks.length).toBeGreaterThanOrEqual(1);
    expect(termsLinks[0]).toHaveAttribute("aria-current", "page");

    const privacyLinks = screen.getAllByRole("link", { name: /privacidade \(lgpd\)/i });
    expect(privacyLinks.length).toBeGreaterThanOrEqual(1);
    expect(privacyLinks[0]).not.toHaveAttribute("aria-current");

    // Botão de acesso à plataforma
    expect(screen.getByRole("button", { name: /acessar plataforma/i })).toBeInTheDocument();
  });

  it("ajusta corretamente o atributo aria-current quando a aba de privacidade está ativa", () => {
    renderWithRouter(
      <LegalPageShell
        activeTab="privacy"
        title="Política de Privacidade"
        description="Diretrizes de proteção e tratamento de dados pessoais conforme a LGPD."
      >
        <p>Conteúdo da política de privacidade.</p>
      </LegalPageShell>,
    );

    const privacyLinks = screen.getAllByRole("link", { name: /privacidade \(lgpd\)/i });
    expect(privacyLinks[0]).toHaveAttribute("aria-current", "page");

    const termsLinks = screen.getAllByRole("link", { name: /termos de uso/i });
    expect(termsLinks[0]).not.toHaveAttribute("aria-current");
  });

  it("disponibiliza skip-link acessível com destino para o conteúdo principal", () => {
    renderWithRouter(
      <LegalPageShell activeTab="terms" title="Termos de Serviço">
        <p>Conteúdo principal.</p>
      </LegalPageShell>,
    );

    const skipLink = screen.getByRole("link", { name: /pular para o conteúdo principal/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#conteudo-legal");

    const mainElement = document.getElementById("conteudo-legal");
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveAttribute("tabindex", "-1");
  });

  it("renderiza metadados institucionais no cabeçalho do documento (título, descrição, versão, foro)", () => {
    renderWithRouter(
      <LegalPageShell
        activeTab="terms"
        title="Termos de Uso e Adesão"
        description="Regras de utilização do software sob o modelo SaaS."
        lastUpdated="23 de Outubro de 2026"
        version="2.0"
      >
        <div>Corpo do contrato.</div>
      </LegalPageShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Termos de Uso e Adesão" })).toBeInTheDocument();
    expect(screen.getByText("Regras de utilização do software sob o modelo SaaS.")).toBeInTheDocument();
    expect(screen.getByText(/23 de Outubro de 2026/)).toBeInTheDocument();
    expect(screen.getByText("Versão 2.0")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(INSTITUTIONAL_CONFIG.legalJurisdiction))).toBeInTheDocument();
    expect(screen.getByText("Corpo do contrato.")).toBeInTheDocument();
  });

  it("renderiza o rodapé institucional completo com Razão Social, CNPJ, endereço e canais oficiais", () => {
    renderWithRouter(
      <LegalPageShell activeTab="terms" title="Termos">
        <p>Texto</p>
      </LegalPageShell>,
    );

    // Razão Social e CNPJ
    expect(screen.getByText(INSTITUTIONAL_CONFIG.companyName)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(INSTITUTIONAL_CONFIG.cnpj))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(INSTITUTIONAL_CONFIG.address))).toBeInTheDocument();

    // DPO e Suporte
    const dpoLink = screen.getByRole("link", { name: INSTITUTIONAL_CONFIG.dpoEmail });
    expect(dpoLink).toHaveAttribute("href", `mailto:${INSTITUTIONAL_CONFIG.dpoEmail}`);

    const supportLink = screen.getByRole("link", { name: INSTITUTIONAL_CONFIG.supportEmail });
    expect(supportLink).toHaveAttribute("href", `mailto:${INSTITUTIONAL_CONFIG.supportEmail}`);

    // Copyright com ano
    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument();
  });

  it("não possui violações de acessibilidade (axe)", async () => {
    const { container } = renderWithRouter(
      <LegalPageShell
        activeTab="terms"
        title="Termos de Serviço e Contrato de Adesão"
        description="Condições contratuais para uso da plataforma Áxis Finance."
        lastUpdated="23 de Outubro de 2026"
        version="2.0"
      >
        <section>
          <h2>Objeto do Contrato</h2>
          <p>Licença de uso de software financeiro.</p>
        </section>
      </LegalPageShell>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
