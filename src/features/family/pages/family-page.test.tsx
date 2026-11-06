import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FamilyPage } from "./family-page";

let mockFamilyData: {
  family?: { id: string; name: string };
} | null = null;
let mockIsFamilyLoading = false;
let mockIsFamilyModeEnabled = false;
let mockIsModeLoading = false;

vi.mock("@/state", () => ({
  useMyFamily: () => ({
    data: mockFamilyData,
    isLoading: mockIsFamilyLoading,
  }),
  useFamilyMode: () => ({
    isFamilyModeEnabled: mockIsFamilyModeEnabled,
    isLoading: mockIsModeLoading,
  }),
}));

function renderPage(initialEntry = "/familia") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/familia" element={<FamilyPage />} />
        <Route path="/" element={<div data-testid="home-page">Página Inicial</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FamilyPage (/familia)", () => {
  beforeEach(() => {
    mockFamilyData = null;
    mockIsFamilyLoading = false;
    mockIsFamilyModeEnabled = false;
    mockIsModeLoading = false;
  });

  it("exibe skeleton durante o carregamento dos dados de família", () => {
    mockIsFamilyLoading = true;
    renderPage();

    expect(screen.getByTestId("family-page-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Orçamento Familiar")).not.toBeInTheDocument();
  });

  it("redireciona para a home (/) quando não houver família ativa", () => {
    mockFamilyData = null;
    mockIsFamilyModeEnabled = false;
    renderPage();

    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.queryByText("Orçamento Familiar")).not.toBeInTheDocument();
  });

  it("renderiza o cabeçalho e nome da unidade familiar quando usuário pertencer a uma família ativa", () => {
    mockFamilyData = {
      family: {
        id: "fam-1",
        name: "Família Silva",
      },
    };
    renderPage();

    expect(screen.getByRole("heading", { name: "Orçamento Familiar" })).toBeInTheDocument();
    expect(screen.getByText("Unidade familiar ativa: Família Silva")).toBeInTheDocument();
    expect(screen.queryByTestId("home-page")).not.toBeInTheDocument();
  });

  it("renderiza quando o modo familiar estiver ativo via preferência", () => {
    mockIsFamilyModeEnabled = true;
    renderPage();

    expect(screen.getByRole("heading", { name: "Orçamento Familiar" })).toBeInTheDocument();
    expect(
      screen.getByText("Orçamento e acompanhamento colaborativo de gastos da casa."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("home-page")).not.toBeInTheDocument();
  });
});
