import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";
import { LogoIcon } from "./logo-icon";
import { LogoFull } from "./logo-full";

describe("BrandLogo — Sistema de Identidade Oficial ÁXIS Finance", () => {
  it("renderiza o símbolo com acessibilidade por padrão", () => {
    render(<BrandLogo />);
    const symbol = screen.getByRole("img", { name: "AXIS" });
    expect(symbol).toBeInTheDocument();
    expect(symbol.tagName.toLowerCase()).toBe("img");
  });

  it("com showWordmark=true exibe o símbolo e o wordmark 'ÁXIS'", () => {
    render(<BrandLogo showWordmark />);
    expect(screen.getByText("ÁXIS")).toBeInTheDocument();
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("renderiza subtítulo 'Finance' por padrão quando showWordmark e showSubtitle são true", () => {
    render(<BrandLogo showWordmark showSubtitle />);
    expect(screen.getByText("ÁXIS")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
  });

  it("renderiza subtítulo customizado se fornecido", () => {
    render(<BrandLogo showWordmark showSubtitle subtitleText="Gestão Inteligente" />);
    expect(screen.getByText("ÁXIS")).toBeInTheDocument();
    expect(screen.getByText("Gestão Inteligente")).toBeInTheDocument();
  });

  it("aceita classes extras no container e no símbolo", () => {
    const { container } = render(
      <BrandLogo className="justify-center" markClassName="size-10" />,
    );
    expect(container.firstChild).toHaveClass("justify-center");
    const markContainer = container.querySelector(".size-10");
    expect(markContainer).toBeInTheDocument();
  });

  it("alterna para a logo Âmbar quando isPro={true}", () => {
    const { container } = render(<BrandLogo isPro={true} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("amber");
  });

  it("alterna para a logo Teal oficial quando isPro={false}", () => {
    const { container } = render(<BrandLogo isPro={false} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("teal");
  });

  it("lê o cache local ('PRO') na montagem imediata sem prop isPro explícita para evitar piscada", () => {
    localStorage.setItem("last_applied_icon_tier", "PRO");
    const { container } = render(<BrandLogo />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("amber");
    localStorage.clear();
  });

  it("lê o cache local ('FREE') na montagem imediata sem prop isPro explícita", () => {
    localStorage.setItem("last_applied_icon_tier", "FREE");
    const { container } = render(<BrandLogo />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("teal");
    localStorage.clear();
  });
});

describe("LogoIcon — Componente Gráfico Áxis Finance", () => {
  it("renderiza imagem de alta resolução com picture e webp", () => {
    const { container } = render(<LogoIcon className="size-12" />);
    const source = container.querySelector("source");
    const img = container.querySelector("img");
    expect(source).toBeInTheDocument();
    expect(source).toHaveAttribute("type", "image/webp");
    expect(img).toBeInTheDocument();
  });

  it("comuta entre Dark e Light mode com base em themeMode", () => {
    const { container: darkContainer } = render(<LogoIcon themeMode="dark" isPro={false} />);
    const darkImg = darkContainer.querySelector("img");
    expect(darkImg?.getAttribute("src")).toContain("teal-dark");

    const { container: lightContainer } = render(<LogoIcon themeMode="light" isPro={false} />);
    const lightImg = lightContainer.querySelector("img");
    expect(lightImg?.getAttribute("src")).toContain("teal-light");
  });

  it("comuta para versão Pro Âmbar Dark e Light", () => {
    const { container: darkPro } = render(<LogoIcon themeMode="dark" isPro={true} />);
    expect(darkPro.querySelector("img")?.getAttribute("src")).toContain("amber-dark");

    const { container: lightPro } = render(<LogoIcon themeMode="light" isPro={true} />);
    expect(lightPro.querySelector("img")?.getAttribute("src")).toContain("amber-light");
  });

  it("suporta variante monocromática com grayscale", () => {
    const { container } = render(<LogoIcon variant="monochrome" />);
    expect(container.firstChild).toHaveClass("grayscale");
  });
});

describe("LogoFull — Lockup Corporativo Completo", () => {
  it("renderiza lockup horizontal com wordmark 'ÁXIS' e símbolo", () => {
    render(<LogoFull />);
    expect(screen.getByText("ÁXIS")).toBeInTheDocument();
    const img = document.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("suporta orientação vertical (empilhada)", () => {
    const { container } = render(
      <LogoFull orientation="vertical" showSubtitle subtitleText="Gestão Inteligente" />,
    );
    expect(container.firstChild).toHaveClass("flex-col");
    expect(screen.getByText("Gestão Inteligente")).toBeInTheDocument();
  });

  it("aplica presets de tamanho proporcional (sm, md, lg, xl)", () => {
    const { container: sm } = render(<LogoFull size="sm" />);
    expect(sm.querySelector(".size-6")).toBeInTheDocument();

    const { container: xl } = render(<LogoFull size="xl" />);
    expect(xl.querySelector(".size-14")).toBeInTheDocument();
  });
});
