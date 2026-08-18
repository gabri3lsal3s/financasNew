import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
  it("renderiza com mensagem padrão e atributos de acessibilidade", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Carregando suas finanças…")).toBeInTheDocument();
    expect(screen.getByText("Organização & Economia")).toBeInTheDocument();
  });

  it("permite customização de mensagem e hint", () => {
    render(<LoadingScreen message="Sincronizando contas…" hint="Aguarde um momento" />);
    expect(screen.getByText("Sincronizando contas…")).toBeInTheDocument();
    expect(screen.getByText("Aguarde um momento")).toBeInTheDocument();
  });
});
