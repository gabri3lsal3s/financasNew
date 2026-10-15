import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedBankTransaction } from "@/domain/notifications";
import * as nativeModule from "@/services/native";
import { PendingSuggestionsCard } from "./pending-suggestions-card";

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("PendingSuggestionsCard (Card de Sugestões de Compras & Pix)", () => {
  const sampleSuggestions: ParsedBankTransaction[] = [
    {
      id: "sug_1",
      bankName: "Nubank",
      type: "expense",
      amountCents: 5290,
      description: "Supermercado Pão de Açúcar",
      date: "2026-10-15",
      paymentMethod: "credit_card",
      rawText: "Compra de R$ 52,90 aprovada",
    },
    {
      id: "sug_2",
      bankName: "Inter",
      type: "income",
      amountCents: 12000,
      description: "Pix de Mariana Lima",
      date: "2026-10-15",
      paymentMethod: "pix",
      rawText: "Você recebeu um Pix de R$ 120,00",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada quando não há sugestões pendentes", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([]);
    const { container } = render(
      <BrowserRouter>
        <PendingSuggestionsCard />
      </BrowserRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza lista de sugestões com informações formatadas", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue(sampleSuggestions);
    render(
      <BrowserRouter>
        <PendingSuggestionsCard />
      </BrowserRouter>,
    );

    expect(screen.getByText("Transações Detectadas")).toBeInTheDocument();
    expect(screen.getByText("2 pendentes")).toBeInTheDocument();
    expect(screen.getByText("Supermercado Pão de Açúcar")).toBeInTheDocument();
    expect(screen.getByText("Pix de Mariana Lima")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText("Inter")).toBeInTheDocument();
  });

  it("chama dismissPendingSuggestion ao clicar em Descartar", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([sampleSuggestions[0]!]);
    const dismissSpy = vi.spyOn(nativeModule, "dismissPendingSuggestion").mockImplementation(() => {});

    render(
      <BrowserRouter>
        <PendingSuggestionsCard />
      </BrowserRouter>,
    );

    const discardBtn = screen.getByRole("button", { name: /Descartar sugestão/i });
    fireEvent.click(discardBtn);

    expect(dismissSpy).toHaveBeenCalledWith("sug_1");
  });

  it("navega para o formulário pré-preenchido ao clicar em Conferir e Salvar", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue([sampleSuggestions[0]!]);

    render(
      <BrowserRouter>
        <PendingSuggestionsCard />
      </BrowserRouter>,
    );

    const confirmBtn = screen.getByRole("button", { name: /Conferir e salvar sugestão/i });
    fireEvent.click(confirmBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("novo=expense&valor=5290&descricao=Supermercado+P%C3%A3o+de+A%C3%A7%C3%BAcar"),
    );
  });

  it("permite descartar todas as sugestões quando houver 2 ou mais", () => {
    vi.spyOn(nativeModule, "usePendingSuggestions").mockReturnValue(sampleSuggestions);
    const clearSpy = vi.spyOn(nativeModule, "clearPendingSuggestions").mockImplementation(() => {});

    render(
      <BrowserRouter>
        <PendingSuggestionsCard />
      </BrowserRouter>,
    );

    const discardAllBtn = screen.getByRole("button", { name: /Descartar todas/i });
    fireEvent.click(discardAllBtn);

    expect(clearSpy).toHaveBeenCalled();
  });
});
