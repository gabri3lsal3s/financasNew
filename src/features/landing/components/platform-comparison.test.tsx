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
    expect(screen.getByText("iPhone & Android")).toBeInTheDocument();
    expect(screen.getByText("Superpoderes")).toBeInTheDocument();
  });

  it("renderiza os diferenciais reais de captura inteligente na tabela detalhada", () => {
    render(<PlatformComparison />);

    // Fatos reais solicitados na Tarefa 6.2:
    expect(
      screen.getByText("Identificação de Notificações Locais (Zero senhas bancárias entregues a terceiros)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Captura Inteligente de Comprovantes (PDF/Imagem/Texto com OCR local gratuito)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Aprendizado Semântico de CNPJ e Nomes Fantasia"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Lançamento Rápido em 3 segundos (tela única)"),
    ).toBeInTheDocument();

    // Outros pilares fundamentais
    expect(screen.getByText("Caixa Real Seguro (Safe-to-Spend) e Daily Budget")).toBeInTheDocument();
    expect(screen.getByText("Rebalanceamento determinístico de aportes")).toBeInTheDocument();
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
