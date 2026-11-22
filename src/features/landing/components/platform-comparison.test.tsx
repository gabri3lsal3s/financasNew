import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PlatformComparison } from "./platform-comparison";

describe("PlatformComparison — Comparação Realista de Plataformas", () => {
  it("renderiza o cabeçalho do tripé de plataformas e os três cards principais", () => {
    render(<PlatformComparison />);

    expect(screen.getByText("O Tripé de Plataformas")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Uma assinatura. Três formas de controlar o seu dinheiro.",
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Web Desktop" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mobile PWA" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Android App Pro" })).toBeInTheDocument();

    expect(screen.getByText("Computador")).toBeInTheDocument();
    expect(screen.getByText("Oficial Recomendado")).toBeInTheDocument();
    expect(screen.getByText("Nativo Pro")).toBeInTheDocument();

    // Linguagem humana sem jargão técnico de Android Intent
    expect(
      screen.getByText(/direto do aplicativo do seu banco no Android/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/via Intent/i)).not.toBeInTheDocument();
  });

  it("expande a matriz detalhada pelo Accordion e mantém rolagem horizontal segura sem prometer IRPF", async () => {
    const user = userEvent.setup();
    const { container } = render(<PlatformComparison />);

    const trigger = screen.getByRole("button", {
      name: /Ver comparativo detalhado por plataforma/i,
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    expect(
      screen.getByText("Compartilhar comprovantes de qualquer banco direto no app"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Captura de comprovantes com OCR no dispositivo"),
    ).toBeInTheDocument();
    expect(screen.getByText("Caixa Real Seguro e orçamento diário")).toBeInTheDocument();
    expect(screen.getByText("Rebalanceamento de aportes sem vender ativos")).toBeInTheDocument();
    expect(
      screen.getByText("Instalação na tela inicial sem loja de aplicativos"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Biometria física (digital ou reconhecimento facial)"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/E mais: DRE Mensal, Lâmina Patrimonial, Memória de Cálculo em 12 módulos/i),
    ).toBeInTheDocument();

    // Garantir ausência de promessas futuras de IRPF / Radar Fiscal
    expect(screen.queryByText(/IRPF|Imposto de Renda|Radar Fiscal/i)).not.toBeInTheDocument();

    // Responsividade da tabela (Regra 25)
    const scrollContainer = container.querySelector(".overflow-x-auto");
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveClass("no-scrollbar", "scroll-smooth");

    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveClass("min-w-[560px]");
  });
});
