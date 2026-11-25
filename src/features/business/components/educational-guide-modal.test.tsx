import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EducationalGuideModal } from "./educational-guide-modal";

describe("EducationalGuideModal", () => {
  it("renderiza o modal aberto na aba de auto-descoberta (Quiz)", () => {
    render(<EducationalGuideModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Guia do Empreendedor & Enquadramento")).toBeInTheDocument();
    expect(screen.getByText("Passo 1 de 3")).toBeInTheDocument();
    expect(
      screen.getByText("Como você formaliza ou pretende formalizar seus serviços?"),
    ).toBeInTheDocument();
  });

  it("permite responder o quiz e receber recomendação personalizada de MEI", async () => {
    const user = userEvent.setup();
    const handleSelectProfile = vi.fn();

    render(
      <EducationalGuideModal
        open={true}
        onOpenChange={vi.fn()}
        onSelectProfile={handleSelectProfile}
      />,
    );

    // Passo 1: MEI
    const meiBtn = screen.getByText("Tenho ou quero abrir MEI");
    await user.click(meiBtn);

    // Passo 2: Faturamento baixo (até 81k)
    expect(await screen.findByText("Passo 2 de 3")).toBeInTheDocument();
    const lowRevBtn = screen.getByText("Até R$ 81.000,00 por ano");
    await user.click(lowRevBtn);

    // Passo 3: Serviços gerais
    expect(await screen.findByText("Passo 3 de 3")).toBeInTheDocument();
    const servBtn = screen.getByText("Serviços Gerais, Técnicos ou Digitais");
    await user.click(servBtn);

    // Resultado: Microempreendedor Individual (MEI)
    expect(
      await screen.findByText("Microempreendedor Individual (MEI)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Perfil Recomendado")).toBeInTheDocument();

    // Aplica o perfil
    const applyBtn = screen.getByRole("button", {
      name: /Configurar como MEI/i,
    });
    await user.click(applyBtn);

    expect(handleSelectProfile).toHaveBeenCalledWith(
      "mei",
      expect.objectContaining({ profileKind: "mei" }),
    );
  });

  it("recomenda Liberal / Autônomo para profissões regulamentadas", async () => {
    const user = userEvent.setup();

    render(<EducationalGuideModal open={true} onOpenChange={vi.fn()} />);

    // Passo 1: Autônomo PF
    const autoBtn = screen.getByText("Autônomo / Pessoa Física");
    await user.click(autoBtn);

    // Passo 2: Faturamento baixo
    const lowRevBtn = await screen.findByText("Até R$ 81.000,00 por ano");
    await user.click(lowRevBtn);

    // Passo 3: Profissão Regulamentada
    const regBtn = await screen.findByText("Profissão Regulamentada / Conselho de Classe");
    await user.click(regBtn);

    // Resultado: Profissional Liberal / Autônomo
    expect(
      await screen.findByText("Profissional Liberal / Autônomo"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Permite deduzir despesas indispensáveis à profissão \(Livro Caixa\)/i),
    ).toBeInTheDocument();
  });

  it("permite navegar para as abas didáticas de separação Pessoal/Profissional e despesas dedutíveis", async () => {
    const user = userEvent.setup();

    render(<EducationalGuideModal open={true} onOpenChange={vi.fn()} />);

    // Alterna para aba Pessoal x Profissional
    const tabSeparation = screen.getByRole("tab", { name: /Pessoal × Profissional na Prática/i });
    await user.click(tabSeparation);

    expect(
      await screen.findByText("A Regra de Ouro: Nunca misture contas bancárias"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pró-labore \(Profissional → Pessoal\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Aporte de Capital \(Pessoal → Profissional\)/i)).toBeInTheDocument();

    // Alterna para aba Despesas Dedutíveis
    const tabDeductible = screen.getByRole("tab", { name: /Despesas Dedutíveis/i });
    await user.click(tabDeductible);

    expect(
      await screen.findByText("Despesas Dedutíveis do Negócio"),
    ).toBeInTheDocument();
    expect(screen.getByText("Gastos que NÃO são da Empresa")).toBeInTheDocument();
  });
});
