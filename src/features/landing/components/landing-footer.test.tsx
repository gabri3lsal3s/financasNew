import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { LandingFooter } from "./landing-footer";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";

function renderFooter() {
  return render(
    <MemoryRouter>
      <LandingFooter />
    </MemoryRouter>,
  );
}

describe("LandingFooter (Rodapé Oficial da Landing Page)", () => {
  it("renderiza a identificação institucional oficial (Razão Social, CNPJ e endereço) conforme Decreto 7.962/2013", () => {
    renderFooter();

    expect(screen.getByText(INSTITUTIONAL_CONFIG.companyName)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(INSTITUTIONAL_CONFIG.cnpj))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(INSTITUTIONAL_CONFIG.address))).toBeInTheDocument();
  });

  it("renderiza os canais de contato com e-mail de suporte e DPO", () => {
    renderFooter();

    const dpoLink = screen.getByRole("link", { name: /Encarregado de Proteção de Dados/i });
    expect(dpoLink).toHaveAttribute("href", `mailto:${INSTITUTIONAL_CONFIG.dpoEmail}`);
    expect(dpoLink).toHaveTextContent(INSTITUTIONAL_CONFIG.dpoEmail);

    const supportLink = screen.getByRole("link", { name: /Suporte ao Consumidor/i });
    expect(supportLink).toHaveAttribute("href", `mailto:${INSTITUTIONAL_CONFIG.supportEmail}`);
    expect(supportLink).toHaveTextContent(INSTITUTIONAL_CONFIG.supportEmail);
  });

  it("renderiza links diretos para as páginas oficiais /termos e /privacidade", () => {
    renderFooter();

    const termsLink = screen.getByRole("link", { name: /^Termos de Serviço$/i });
    expect(termsLink).toHaveAttribute("href", "/termos");

    const privacyLink = screen.getByRole("link", { name: /^Privacidade \(LGPD\)$/i });
    expect(privacyLink).toHaveAttribute("href", "/privacidade");
  });

  it("permite abrir o diálogo de resumo rápido através dos botões", async () => {
    const user = userEvent.setup();
    renderFooter();

    const termsButton = screen.getByRole("button", { name: /^Termos de Serviço$/i });
    await user.click(termsButton);

    expect(
      screen.getByText("Termos de Serviço & Privacidade (LGPD)"),
    ).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: /entendido/i });
    await user.click(closeButton);
  });

  it("não possui violações de acessibilidade (axe)", async () => {
    const { container } = renderFooter();
    expect(await axe(container)).toHaveNoViolations();
  });
});
