import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "./global-search";
import type { SearchEntry } from "@/domain/search";

const navigateMock = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

const entries: SearchEntry[] = [
  {
    id: "e1",
    type: "expense",
    text: ["mercado extra", "alimentacao", "pix", "despesa"],
    amountCents: 25000,
    date: "2026-08-01",
    label: "Mercado Extra",
    detail: "Alimentação · Pix · 01/08/2026",
    link: { path: "/transacoes", params: { month: "2026-08", q: "e1" } },
  },
  {
    id: "d1",
    type: "debt",
    text: ["conta de luz", "a pagar", "divida"],
    amountCents: 20000,
    date: "2026-08-20",
    statusWords: ["Pendente"],
    label: "Conta de luz",
    detail: "A pagar · Pendente · vence 20/08/2026",
    link: { path: "/dividas", params: { q: "d1", type: "payable" } },
  },
  {
    id: "c1",
    type: "card",
    text: ["nubank", "cartao"],
    label: "Nubank",
    detail: "Cartão de crédito",
    link: { path: "/cartoes", params: { card: "c1" } },
  },
  {
    id: "cat1",
    type: "category",
    text: ["alimentacao", "despesa", "categoria"],
    label: "Alimentação",
    detail: "Categoria de despesa",
    link: { path: "/categorias", params: { q: "cat1", type: "expense" } },
  },
];

vi.mock("@/state", () => ({
  useGlobalSearchEntries: (enabled: boolean) => ({
    entries: enabled ? entries : [],
    isLoading: false,
    error: null,
  }),
}));

describe("GlobalSearch (busca global ⌘K §3.9)", () => {
  it("abre pelo botão e pede ao menos 2 caracteres", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar (Ctrl+K)" }));
    expect(screen.getByPlaceholderText(/Buscar despesas/)).toBeInTheDocument();
    expect(screen.getByText("Digite ao menos 2 caracteres para buscar.")).toBeInTheDocument();
  });

  it("agrupa resultados por tipo e navega pelo deep-link", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar (Ctrl+K)" }));
    await user.type(screen.getByPlaceholderText(/Buscar despesas/), "mercado");

    // Grupo "Despesas" com o resultado.
    expect(screen.getByText("Despesas")).toBeInTheDocument();
    expect(screen.getByText("Mercado Extra")).toBeInTheDocument();

    await user.click(screen.getByText("Mercado Extra"));
    expect(navigateMock).toHaveBeenCalledWith("/transacoes?month=2026-08&q=e1");
  });

  it("busca cartões pelo nome e navega", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar (Ctrl+K)" }));
    await user.type(screen.getByPlaceholderText(/Buscar despesas/), "nubank");

    expect(screen.getByText("Cartões")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    await user.click(screen.getByText("Nubank"));
    expect(navigateMock).toHaveBeenCalledWith("/cartoes?card=c1");
  });

  it("busca dívidas pelo status e navega com a aba correta", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar (Ctrl+K)" }));
    await user.type(screen.getByPlaceholderText(/Buscar despesas/), "pendente");

    expect(screen.getByText("Dívidas")).toBeInTheDocument();
    await user.click(screen.getByText("Conta de luz"));
    expect(navigateMock).toHaveBeenCalledWith("/dividas?q=d1&type=payable");
  });
});
