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
    id: "action-1",
    type: "action",
    text: ["nova despesa", "gasto"],
    label: "Nova Despesa",
    detail: "Lançar nova despesa ou compra",
    link: { path: "/transacoes", params: { action: "new-expense" } },
  },
  {
    id: "ast-1",
    type: "investment",
    text: ["PETR4", "Petrobras", "Ações"],
    amountCents: 350000,
    label: "PETR4 · Petróleo",
    detail: "Ações · 100 cotas",
    link: { path: "/investimentos", params: { q: "ast-1", ticker: "PETR4" } },
  },
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

describe("GlobalSearch (busca global ⌘K §3.9 & Fase 64)", () => {
  it("abre pelo botão e pede ao menos 2 caracteres", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar ou executar comando (Ctrl+K)" }));
    expect(screen.getByPlaceholderText(/Buscar páginas, ações/)).toBeInTheDocument();
    expect(screen.getByText("Digite ao menos 2 caracteres para buscar.")).toBeInTheDocument();
  });

  it("agrupa resultados por tipo e navega pelo deep-link", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar ou executar comando (Ctrl+K)" }));
    await user.type(screen.getByPlaceholderText(/Buscar páginas, ações/), "mercado");

    // Grupo "Despesas" com o resultado.
    expect(screen.getByText("Despesas")).toBeInTheDocument();
    expect(screen.getByText("Mercado Extra")).toBeInTheDocument();

    await user.click(screen.getByText("Mercado Extra"));
    expect(navigateMock).toHaveBeenCalledWith("/transacoes?month=2026-08&q=e1");
  });

  it("busca cartões pelo nome e navega", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar ou executar comando (Ctrl+K)" }));
    await user.type(screen.getByPlaceholderText(/Buscar páginas, ações/), "nubank");

    expect(screen.getByText("Cartões de Crédito")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    await user.click(screen.getByText("Nubank"));
    expect(navigateMock).toHaveBeenCalledWith("/cartoes?card=c1");
  });

  it("busca dívidas pelo status e navega com a aba correta", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar ou executar comando (Ctrl+K)" }));
    await user.type(screen.getByPlaceholderText(/Buscar páginas, ações/), "pendente");

    expect(screen.getByText("Dívidas & Empréstimos")).toBeInTheDocument();
    await user.click(screen.getByText("Conta de luz"));
    expect(navigateMock).toHaveBeenCalledWith("/dividas?q=d1&type=payable");
  });

  it("busca ações operacionais rápidas e navega", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar ou executar comando (Ctrl+K)" }));
    await user.type(screen.getByPlaceholderText(/Buscar páginas, ações/), "nova despesa");

    expect(screen.getByText("Ações Rápidas")).toBeInTheDocument();
    await user.click(screen.getByText("Nova Despesa"));
    expect(navigateMock).toHaveBeenCalledWith("/transacoes?action=new-expense");
  });

  it("busca ativos de investimento e tickers", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.click(screen.getByRole("button", { name: "Buscar ou executar comando (Ctrl+K)" }));
    await user.type(screen.getByPlaceholderText(/Buscar páginas, ações/), "petr4");

    expect(screen.getByText("Investimentos & Ativos")).toBeInTheDocument();
    await user.click(screen.getByText("PETR4 · Petróleo"));
    expect(navigateMock).toHaveBeenCalledWith("/investimentos?q=ast-1&ticker=PETR4");
  });
});
