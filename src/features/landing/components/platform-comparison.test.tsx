import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlatformComparison } from "./platform-comparison";

describe("PlatformComparison — Comparação Realista de Plataformas (Fase 6 — Tarefa 6.2)", () => {
  it("renderiza o cabeçalho do tripé de plataformas", () => {
    render(<PlatformComparison />);

    expect(screen.getByText("O Tripé de Plataformas")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Uma assinatura. Três formas de controlar o seu dinheiro." }),
    ).toBeInTheDocument();
  });

  it("renderiza os três cards de apresentação das plataformas", () => {
    render(<PlatformComparison />);

    expect(screen.getByRole("heading", { name: "Web Desktop" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mobile PWA" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Android App Pro" })).toBeInTheDocument();

    expect(screen.getByText("Computador")).toBeInTheDocument();
    expect(screen.getByText("Oficial Recomendado")).toBeInTheDocument();
    expect(screen.getByText("Nativo Pro")).toBeInTheDocument();
  });

  it("renderiza apenas os diferenciais reais na tabela e resume o restante em uma linha", () => {
    render(<PlatformComparison />);

    // Matriz enxuta: 6 linhas que realmente diferenciam as plataformas
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

    // O restante do catálogo vive em uma única linha de resumo
    expect(screen.getByText(/E mais: Radar Fiscal, Escudo de Privacidade/i)).toBeInTheDocument();
  });

  it("garante responsividade da tabela com container de rolagem horizontal e min-width seguro", () => {
    const { container } = render(<PlatformComparison />);

    const scrollContainer = container.querySelector(".overflow-x-auto");
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveClass("no-scrollbar", "scroll-smooth");

    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveClass("min-w-[560px]");
  });
});
