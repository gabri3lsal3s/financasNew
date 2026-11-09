import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SharedFinancesShowcase } from "./shared-finances-showcase";

describe("SharedFinancesShowcase — Cards Visuais do Eixo 4", () => {
  it("renderiza a barra de abas com os 3 cards do Eixo 4", () => {
    render(<SharedFinancesShowcase />);

    expect(screen.getByRole("tab", { name: /Racha com Pix/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Vaquinha Coletiva/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Orçamento Familiar/i })).toBeInTheDocument();
  });

  it("exibe o Card 1: Racha de Despesas com cópia de Pix e botão de WhatsApp por padrão", async () => {
    const user = userEvent.setup();
    render(<SharedFinancesShowcase />);

    expect(screen.getByTestId("card-racha")).toBeVisible();
    expect(screen.getByText("Churrasco de Confraternização")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 pagaram")).toBeInTheDocument();
    expect(screen.getAllByText("Mariana Costa")[0]).toBeInTheDocument();
    expect(screen.getByText("Lucas Oliveira")).toBeInTheDocument();
    expect(screen.getByText("Beatriz Souza")).toBeInTheDocument();

    const copyBtn = screen.getAllByRole("button", { name: /Copiar Pix/i })[0]!;
    await user.click(copyBtn);
    expect(screen.getByText("Pix Copiado")).toBeInTheDocument();

    const whatsAppBtn = screen.getAllByRole("button", { name: /Cobrar no WhatsApp/i })[0]!;
    await user.click(whatsAppBtn);
    expect(screen.getByText("Lembrete Enviado")).toBeInTheDocument();
  });

  it("permite alternar para o Card 2: Termômetro de Vaquinha Coletiva em tempo real", async () => {
    const user = userEvent.setup();
    render(<SharedFinancesShowcase />);

    const goalTab = screen.getByRole("tab", { name: /Vaquinha Coletiva/i });
    await user.click(goalTab);

    expect(screen.getByTestId("card-vaquinha")).toBeVisible();
    expect(screen.getByText("Viagem de Fim de Ano em Família")).toBeInTheDocument();
    expect(screen.getByText("75% Concluído")).toBeInTheDocument();
    expect(screen.getByText("75% Atual")).toBeInTheDocument();
    expect(screen.getByText(/Restam 14 dias para encerrar/i)).toBeInTheDocument();

    const copyKeyBtn = screen.getAllByRole("button", { name: /Copiar Chave Pix/i })[0]!;
    await user.click(copyKeyBtn);
    expect(screen.getByText("Chave Pix Copiada")).toBeInTheDocument();
  });

  it("permite alternar para o Card 3: Orçamento Familiar Seguro (divisão 50/50 e acerto sem atrito)", async () => {
    const user = userEvent.setup();
    render(<SharedFinancesShowcase />);

    const familyTab = screen.getByRole("tab", { name: /Orçamento Familiar/i });
    await user.click(familyTab);

    expect(screen.getByTestId("card-familia")).toBeVisible();
    expect(screen.getByText("Gestão do Lar · Família Silva")).toBeInTheDocument();
    expect(screen.getByText("Divisão 50% / 50%")).toBeInTheDocument();
    expect(screen.getByText(/Compensação Automática Calculada:/i)).toBeInTheDocument();
    expect(screen.getByText(/Camila deve transferir/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacidade absoluta/i)).toBeInTheDocument();

    const settleBtn = screen.getByRole("button", { name: /Liquidar Acerto Pix/i });
    await user.click(settleBtn);
    expect(screen.getByText("Acerto Quitado")).toBeInTheDocument();
  });
});
